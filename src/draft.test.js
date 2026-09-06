import test from 'node:test';
import assert from 'node:assert/strict';
import {teamAt,rosterSlots,recommendations,validateImport} from './draft.js';
import {samplePlayers,defaultSettings} from './data.js';
test('snake reverses at round boundaries',()=>{assert.deepEqual(Array.from({length:12},(_,i)=>teamAt(i,4)),[1,2,3,4,4,3,2,1,1,2,3,4]);});
test('roster fills starters then flex then bench',()=>{const r=rosterSlots(Array.from({length:4},(_,i)=>({id:i,position:'RB'})));assert.ok(r[1].player);assert.ok(r[2].player);assert.ok(r[6].player);assert.ok(r[9].player);assert.equal(r[0].player,null);});
test('taken players are excluded, starter needs affect recommendations',()=>{const pool=[{id:'a',name:'A',position:'QB',rank:1},{id:'b',name:'B',position:'QB',rank:2},{id:'c',name:'C',position:'WR',rank:3}];const rec=recommendations(pool,[{playerId:'a',team:5}],defaultSettings);assert.equal(rec.length,2);assert.equal(rec[0].id,'c');assert.ok(!rec.some(p=>p.id==='a'));});
test('imports reject invalid and duplicated data',()=>{assert.throws(()=>validateImport([]));assert.throws(()=>validateImport([{name:'A',position:'WR',rank:'1'}]));assert.throws(()=>validateImport([{name:'A',position:'WR',rank:1},{name:'a',position:'RB',rank:2}]));assert.equal(validateImport([{name:'A',position:'WR',rank:1}])[0].team,'FA');});
test('sample draft can assign every player without duplicates',()=>{let picks=[];for(let i=0;i<samplePlayers.length;i++){const p=recommendations(samplePlayers,picks,defaultSettings)[0];assert.ok(p);picks.push({playerId:p.id,team:teamAt(i,12)});}assert.equal(new Set(picks.map(p=>p.playerId)).size,samplePlayers.length);assert.equal(recommendations(samplePlayers,picks,defaultSettings).length,0);});

import {applyLeagueProfile, canDraft, leagueProfile} from './league.js';
test('league migration preserves picks and applies confirmed position five',()=>{const saved={players:samplePlayers,picks:[{playerId:'QB-0',team:4}],settings:{teams:12,slot:4,rounds:16}};const migrated=applyLeagueProfile(saved);assert.deepEqual(migrated.picks,saved.picks);assert.equal(migrated.settings.name,'Nevada vs California');assert.equal(migrated.settings.slotConfirmed,true);assert.equal(migrated.settings.slot,5);assert.equal(migrated.settings.rounds,16);assert.equal(migrated.settings.irSlots,1);});
test('position maximums apply to the selected team without blocking opponents',()=>{const picks=samplePlayers.filter(p=>p.position==='TE').slice(0,3).map(p=>({playerId:p.id,team:4}));const player=samplePlayers.find(p=>p.id==='TE-4');assert.equal(canDraft(player,samplePlayers,picks,leagueProfile,4),false);assert.equal(canDraft(player,samplePlayers,picks,leagueProfile,5),true);});

test("confirmed fifth slot follows snake order",()=>{assert.deepEqual(Array.from({length:48},(_,i)=>i).filter(i=>teamAt(i,12)===5).map(i=>i+1),[5,20,29,44]);});

import {strategyContext} from './draft.js';
const mockPickCount=n=>Array.from({length:n},(_,i)=>({playerId:`unlisted-${i}`,team:teamAt(i,12)}));
test('strategy uses your next round after your current round pick',()=>{
 const context=strategyContext(mockPickCount(20),defaultSettings);
 assert.equal(context.round,3);assert.equal(context.nextPick,29);
});
test('first round prefers RB/WR over slightly higher ranked QB and TE',()=>{
 const pool=[{id:'q',name:'QB',position:'QB',rank:1},{id:'t',name:'TE',position:'TE',rank:2},{id:'w',name:'WR',position:'WR',rank:4},{id:'r',name:'RB',position:'RB',rank:5}];
 assert.deepEqual(recommendations(pool,[],defaultSettings).slice(0,2).map(p=>p.position),['WR','RB']);
});
test('early TE at a large rank discount remains a value option',()=>{
 const pool=[{id:'t',name:'TE',position:'TE',rank:10},{id:'w',name:'WR',position:'WR',rank:50}];
 const rec=recommendations(pool,mockPickCount(36),defaultSettings);
 assert.equal(rec[0].id,'t');assert.match(rec[0].reason,/ranked at least a round/);
});
test('defense and kicker are delayed until final two rounds',()=>{
 const pool=[{id:'d',name:'DST',position:'DST',rank:80},{id:'k',name:'K',position:'K',rank:90},{id:'r',name:'RB',position:'RB',rank:140}];
 assert.equal(recommendations(pool,mockPickCount(144),defaultSettings)[0].id,'r');
 assert.equal(recommendations(pool,mockPickCount(168),defaultSettings)[0].id,'d');
});
test('final remaining pick only recommends required starter, not bench value',()=>{
 const positions=['QB','RB','RB','WR','WR','TE','RB','DST','RB','RB','WR','WR','WR','WR','TE'];
 const owned=positions.map((position,i)=>({id:`owned-${i}`,name:`Owned ${i}`,position,rank:i+1}));
 const pool=[...owned,{id:'k',name:'Kicker',position:'K',rank:200},{id:'r',name:'Runner',position:'RB',rank:20}];
 const picks=mockPickCount(187);let i=0;
 for(const pick of picks)if(pick.team===5)pick.playerId=owned[i++].id;
 const eligible=recommendations(pool,picks,defaultSettings).filter(p=>p.recommendable);
 assert.deepEqual(eligible.map(p=>p.id),['k']);
});
test('FLEX fit is reported independently of the strategy explanation',()=>{
 const pool=Array.from({length:3},(_,i)=>({id:`r${i}`,name:`RB ${i}`,position:'RB',rank:i+1}));
 const rec=recommendations(pool,[{playerId:'r0',team:5},{playerId:'r1',team:5}],defaultSettings);
 assert.equal(rec[0].rosterFit,'Open FLEX spot');
});

import {mergeRankings,managerSignal,playerKey} from './rankings.js';
import {readFileSync} from 'node:fs';
const currentSnapshot=JSON.parse(readFileSync(new URL('./current-rankings.json',import.meta.url)));
test('live snapshot is 2026 full PPR, large enough for draft, and IDs are unique',()=>{
 assert.equal(currentSnapshot.metadata.season,2026);assert.equal(currentSnapshot.metadata.scoring,'PPR');
 assert.ok(currentSnapshot.players.length>=300);assert.equal(new Set(currentSnapshot.players.map(p=>p.id)).size,currentSnapshot.players.length);
 for(const p of currentSnapshot.players){assert.ok(Number.isFinite(p.rank)&&p.rank>0);if(p.age!=null)assert.ok(p.age>=18&&p.age<60);}
});
test('sample draft migration retains names, owners, order, and undrafted availability',()=>{
 const chosen=samplePlayers.slice(0,25);const state={players:samplePlayers,picks:chosen.map((p,i)=>({playerId:p.id,team:teamAt(i,12)})),settings:defaultSettings};
 const merged=mergeRankings(state,currentSnapshot);
 assert.equal(merged.picks.length,25);
 merged.picks.forEach((pick,i)=>{assert.equal(pick.team,state.picks[i].team);assert.equal(playerKey(merged.players.find(p=>p.id===pick.playerId)),playerKey(chosen[i]));});
 assert.equal(new Set(merged.players.map(playerKey)).size,merged.players.length);
 assert.deepEqual(mergeRankings(merged,currentSnapshot).picks,merged.picks);
});
test('unknown already-drafted player survives refresh as unranked',()=>{
 const old={id:'legacy',name:'Unknown Legacy',position:'WR',team:'FA',rank:1};
 const merged=mergeRankings({players:[old],picks:[{playerId:old.id,team:5}],settings:defaultSettings},currentSnapshot);
 assert.equal(merged.picks[0].playerId,'legacy');assert.equal(merged.players.find(p=>p.id==='legacy').unranked,true);
});
test('manager sentiment has limited weight and missing observations stay unknown',()=>{
 assert.deepEqual(managerSignal({}),{points:0,label:'Not in trend lists'});
 assert.equal(managerSignal({managerInterest:{adds:500,drops:null}}).points,1);
 assert.equal(managerSignal({managerInterest:{adds:null,drops:500}}).points,-1);
 assert.ok(Math.abs(managerSignal({managerInterest:{adds:999999,drops:1}}).points)<=2);
});
test('unavailable and unranked players are trackable but not shortlisted',()=>{
 const pool=[{id:'x',name:'Out Player',position:'RB',rank:1,team:'DET',injuryStatus:'Out'},{id:'y',name:'Healthy Player',position:'WR',rank:2,team:'CIN'}];
 const rec=recommendations(pool,[],defaultSettings);assert.equal(rec.length,2);assert.deepEqual(rec.filter(p=>p.recommendable).map(p=>p.id),['y']);
});
