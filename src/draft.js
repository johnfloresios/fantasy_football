import {managerSignal} from './rankings.js';
import {slots} from './data.js';
export function teamAt(index, teams) {const round=Math.floor(index/teams);return round%2===0 ? index%teams+1 : teams-index%teams;}
export function rosterSlots(players, rounds=16) {const result=slots.slice(0,rounds).map(position=>({position,player:null}));while(result.length<rounds)result.push({position:'BN',player:null});for(const player of players){const slot=result.find(s=>!s.player&&s.position===player.position)||result.find(s=>!s.player&&s.position==='FLEX'&&['RB','WR','TE'].includes(player.position))||result.find(s=>!s.player&&s.position==='BN');if(slot)slot.player=player;}return result;}
// Strategy weights are app heuristics; ranks must match the league's PPR scoring.
export function strategyContext(picks, settings) {
  const mineCount=picks.filter(p=>p.team===settings.slot).length;
  let next=picks.length;
  const total=settings.teams*settings.rounds;
  while(next<total&&teamAt(next,settings.teams)!==settings.slot)next++;
  const complete=next>=total||mineCount>=settings.rounds;
  const round=complete?settings.rounds:Math.floor(next/settings.teams)+1;
  const phase=complete?'Complete':round<=4?'Build your core':round<=9?'Add starters and depth':round<settings.rounds-1?'Strengthen your bench':'Finish your lineup';
  const plan=complete?'Your draft is finished.':round<=4?'Prioritize RB/WR value. Wait on QB; consider TE only at a meaningful discount.':round<=9?'Keep building RB/WR depth and look for your starting QB and TE at good value.':round<settings.rounds-1?'Favor RB/WR depth over backup QBs and TEs. Fill any remaining offensive starter spots.':'Fill remaining starter slots, including one defense and one kicker.';
  return {round,nextPick:complete?null:next+1,phase,plan,complete};
}
export function recommendations(players, picks, settings) {
  const taken=new Set(picks.map(p=>p.playerId));
  const mine=picks.filter(p=>p.team===settings.slot).map(p=>players.find(x=>x.id===p.playerId)).filter(Boolean);
  const roster=rosterSlots(mine,settings.rounds);
  const open=roster.filter(s=>!s.player&&s.position!=='BN');
  const remaining=settings.rounds-mine.length;
  const {round,complete}=strategyContext(picks,settings);
  return players.filter(p=>!taken.has(p.id)).map(p=>{
    const skill=['RB','WR'].includes(p.position);
    const special=['K','DST'].includes(p.position);
    const count=mine.filter(m=>m.position===p.position).length;
    const direct=open.some(s=>s.position===p.position);
    const flex=!direct&&['RB','WR','TE'].includes(p.position)&&open.some(s=>s.position==='FLEX');
    const fills=direct||flex;
    const mustFill=remaining<=open.length;
    const interest=managerSignal(p);
    let score=1000-p.rank+interest.points;
    let reason='Best remaining rank at this position';
    if(round===1){
      if(skill){score+=100;reason='Build your core with a top-ranked RB or WR';}
      else {score-=200;reason='Wait: prioritize RB/WR in Round 1';}
    } else if(round<=4){
      if(skill){score+=35;reason='Early-round RB/WR value';}
      if(p.position==='QB'){score-=70;reason='Wait on QB while building your RB/WR core';}
      if(p.position==='TE'){
        const discounted=p.rank<=(round-2)*settings.teams;
        score+=discounted?15:-40;
        reason=discounted?'TE ranked at least a round ahead of this pick':'Wait for better TE value';
      }
    } else if(round<=9){
      if(skill){score+=25;reason='Build RB/WR strength for starters and FLEX';}
      if(direct&&['QB','TE'].includes(p.position)){
        score+=round>=7?30:5;
        reason=`Consider your starting ${p.position} at this price`;
      }
    } else if(skill){score+=35;reason='Add RB/WR bench depth';}
    if(skill){score+=direct?12:flex?8:0;score-=Math.max(0,count-4)*18;}
    if(round>=10&&direct&&!special){score+=100;reason=`Fill your remaining starting ${p.position} spot`;}
    if(count&&['QB','TE'].includes(p.position)){score-=140;reason=`You have a ${p.position}; prefer RB/WR depth`;}
    if(special){
      score-=round<settings.rounds-1?500:0;
      reason=round<settings.rounds-1?'Wait until the final two rounds':`Fill your starting ${p.position==='DST'?'defense':'kicker'} spot`;
      if(count){score-=500;reason=`You already have a ${p.position}; avoid a backup`;}
      else if(round>=settings.rounds-1)score+=250;
    }
    if(mustFill&&fills){score+=10000;reason=flex?'Complete your required FLEX slot':`Complete your required ${p.position} slot`;}
    const limit=settings.limits?.[p.position]??Infinity;
    const unavailable=['IR','Out','Suspended','PUP'].includes(p.injuryStatus)||['Inactive','Retired'].includes(p.status)||p.team==='FA'||p.unranked;
    if(unavailable)reason=`Check availability: ${p.injuryStatus||p.status||'no current team/rank'}`;
    const recommendable=!unavailable&&!complete&&count<limit&&(!mustFill||fills);
    return {...p,score,reason,rosterFit:direct?'Open starter spot':flex?'Open FLEX spot':'Bench depth',recommendable};
  }).sort((a,b)=>b.score-a.score||a.rank-b.rank||a.name.localeCompare(b.name));
}
export function validateImport(input){if(!Array.isArray(input)||input.length===0)throw Error('Provide a JSON array of players.');const names=new Set();return input.map((p,i)=>{if(!p||typeof p.name!=='string'||!p.name.trim()||!['QB','RB','WR','TE','K','DST'].includes(p.position)||typeof p.rank!=='number'||!Number.isFinite(p.rank)||p.rank<1)throw Error(`Player ${i+1}: name, valid position, and a positive numeric rank are required.`);if(names.has(p.name.trim().toLowerCase()))throw Error(`Duplicate player: ${p.name}`);names.add(p.name.trim().toLowerCase());return {id:`import-${i}`,name:p.name.trim(),position:p.position,rank:p.rank,team:typeof p.team==='string'?p.team:'FA'};}).sort((a,b)=>a.rank-b.rank);}
