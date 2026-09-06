// Supplied by the league owner from ESPN settings, September 6, 2026.
export const leagueProfile = {
  name: 'Nevada vs California', myTeam: 'Johnny Knows Best', teams: 12,
  rounds: 16, scoring: 'PPR', draftType: 'Snake', pickSeconds: 90,
  draftDate: '2026-09-06T13:00:00-07:00', irSlots: 1,
  limits: {QB: 4, RB: 8, WR: 8, TE: 3, K: 3, DST: 3},
  members: ['Incredible Commish', 'Get down, Get Purdy', 'Annexation of Puerto Rico', 'JTS Cards Reigns Supreme', 'Ashton Powers', 'No Punt Intended', 'Wonder Woman Winners', 'Johnny Knows Best', 'Touchdown Syndrome', 'Threat Level Midnight', 'HonestE', 'Maye-hem Managed'],
  scoringDetails: {
    Passing: '0.04/yard · 4/TD · −2/interception · 2/2pt conversion; +1 for each listed 40+ and 50+ yard TD bonus; +1 for 300–399 or 400+ yard games.',
    Rushing: '0.1/yard · 6/TD · 2/2pt conversion; +1 for each listed 40+ and 50+ yard TD bonus; +1 for 100–199 or 200+ yard games.',
    Receiving: '1/reception · 0.1/yard · 6/TD · 2/2pt conversion; +1 for each listed 40+ and 50+ yard TD bonus; +1 for 100–199 or 200+ yard games.',
    Kicking: '1/PAT · −1/missed FG · 3/FG from 0–39 yards · 4 from 40–49 · 5 from 50–59 · 6 from 60+.',
    'D/ST plays': '6/return TD · 1/sack · 2/blocked kick, interception, fumble recovery or safety · 2/2pt return · 1/1pt safety.',
    'D/ST points allowed': '0: +5 · 1–6: +4 · 7–13: +3 · 14–17: +1 · 18–27: 0 · 28–34: −1 · 35–45: −3 · 46+: −5.',
    'D/ST yards allowed': '<100: +5 · 100–199: +3 · 200–299: +2 · 300–349: 0 · 350–399: −1 · 400–449: −3 · 450–499: −5 · 500–549: −6 · 550+: −7.',
    Miscellaneous: '−2/fumble lost · 6/return TD or fumble recovered for TD · 2/2pt return · 1/1pt safety.'
  }
};
export function applyLeagueProfile(saved) {
  if(saved.settings.leagueProfileVersion===2)return saved;
  if(saved.settings.leagueProfileVersion===1)return {...saved,settings:{...saved.settings,slot:5,slotConfirmed:true,leagueProfileVersion:2}};
  return {...saved,settings:{...saved.settings,...leagueProfile,leagueProfileVersion:2,slot:5,slotConfirmed:true}};
}
export function canDraft(player, players, picks, settings, team) {
  const teamPicks=picks.filter(p=>p.team===team);
  if(teamPicks.length>=settings.rounds)return false;
  const count=teamPicks.filter(p=>players.find(x=>x.id===p.playerId)?.position===player.position).length;
  return count<(settings.limits?.[player.position]??Infinity);
}
