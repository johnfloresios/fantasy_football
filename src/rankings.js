export function playerKey(player) {
  if(player.position==='DST')return `DST:${player.team==='JAC'?'JAX':player.team}`;
  const name=player.name.toLowerCase().replace(/\b(jr|sr|iii|ii|iv)\b/g,'').replace(/[^a-z0-9]/g,'');
  const aliases={kennethgainwell:'kennygainwell',zonovanknight:'bamknight',gabrieldavis:'gabedavis',marquisebrown:'hollywoodbrown'};
  return `${player.position}:${aliases[name]||name}`;
}
// Keep every draft selection and its owner. Unknown drafted names remain as unranked records.
export function mergeRankings(state, snapshot) {
  const oldByKey=new Map(state.players.map(p=>[playerKey(p),p]));
  const replacements=new Map();
  const players=snapshot.players.map(p=>{
    const old=oldByKey.get(playerKey(p));
    if(old)replacements.set(old.id,p.id);
    return {...p};
  });
  const taken=new Set(state.picks.map(p=>p.playerId));
  for(const old of state.players)if(taken.has(old.id)&&!replacements.has(old.id)){
    players.push({...old,rank:10000,expertRank:null,unranked:true});
    replacements.set(old.id,old.id);
  }
  return {...state,players,picks:state.picks.map(p=>({...p,playerId:replacements.get(p.playerId)||p.playerId})),custom:false,rankingVersion:snapshot.metadata.version,rankingMetadata:snapshot.metadata};
}
export function managerSignal(player) {
  const trend=player.managerInterest;
  if(!trend)return {points:0,label:'Not in trend lists'};
  const {adds,drops}=trend;
  // Lists are truncated: an absent entry is unknown, never zero.
  if(adds==null)return {points:-1,label:'Top drops list'};
  if(drops==null)return {points:1,label:'Top adds list'};
  const ratio=(adds-drops)/Math.max(1,adds+drops);
  return {points:Math.round(ratio*20)/10,label:ratio>.15?'More adds':ratio<-.15?'More drops':'Mixed interest'};
}
export function ageContext(player) {
  if(player.age==null)return player.position==='DST'?'Team unit':'Age unavailable';
  return `${player.age} years old`;
}
