"""Refresh factual draft/player data. Run at most daily (Sleeper player endpoint)."""
import datetime, json, pathlib, re, urllib.request, argparse
ROOT=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--cached',action='store_true');args=parser.parse_args()
urls={'fp':'https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php','sleeper':'https://api.sleeper.app/v1/players/nfl','add':'https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=100','drop':'https://api.sleeper.app/v1/players/nfl/trending/drop?lookback_hours=24&limit=100'}
def fetch(key):
    if args.cached:return pathlib.Path('/tmp/draft-'+key).read_text()
    with urllib.request.urlopen(urls[key],timeout=45) as response:return response.read().decode()
def norm(name):return re.sub(r'[^a-z0-9]','',re.sub(r'\b(jr|sr|iii|ii|iv)\b','',name.lower()))
html=fetch('fp');ecr=json.JSONDecoder().raw_decode(html.split('var ecrData = ',1)[1])[0]
adp=json.JSONDecoder().raw_decode(html.split('var adpData = ',1)[1])[0]
assert ecr['year']=='2026' and ecr['scoring']=='PPR' and ecr['week']=='0', 'Wrong season, scoring or weekly data'
assert len(ecr['players'])>=250,'Unexpectedly small ranking pool'
bios=json.loads(fetch('sleeper'));adds={p['player_id']:p['count'] for p in json.loads(fetch('add'))};drops={p['player_id']:p['count'] for p in json.loads(fetch('drop'))}
market={str(p['player_id']):p['rank_ecr'] for p in adp}
index={}
for p in bios.values():index.setdefault((norm(p.get('full_name') or ''),p.get('position')),[]).append(p)
aliases={'bamknight':'zonovanknight','hollywoodbrown':'marquisebrown','gabedavis':'gabrieldavis','mitchtrubisky':'mitchelltrubisky','chigdulcich':'gregdulcich'}
now=datetime.datetime.now(datetime.timezone.utc);today=now.date();players=[];unmatched=[]
for p in ecr['players']:
    name=p['player_name'];position=p['player_position_id'];team={'JAC':'JAX'}.get(p['player_team_id'],p['player_team_id']);key=norm(name)
    matches=index.get((key,position),[]) or index.get((aliases.get(key,key),position),[])
    if not matches:
        matches=[b for b in bios.values() if norm(b.get('full_name') or '')==key and (position in (b.get('fantasy_positions') or []) or (position=='RB' and b.get('position')=='FB'))]
    if position=='DST':matches=[bios.get(team,{})]
    if len(matches)>1:
        same=[b for b in matches if b.get('team')==team]
        matches=same if len(same)==1 else []
    bio=matches[0] if len(matches)==1 else {}
    sid=bio.get('player_id');birth=bio.get('birth_date');age=None
    if birth and position!='DST':
        b=datetime.date.fromisoformat(birth);age=today.year-b.year-((today.month,today.day)<(b.month,b.day))
    if not bio and position!='DST':unmatched.append(name)
    trend= None if sid not in adds and sid not in drops else {'adds':adds.get(sid),'drops':drops.get(sid),'windowHours':24}
    players.append({'id':'fp-'+str(p['player_id']),'name':name,'position':position,'team':team,'rank':p['rank_ecr'],'expertRank':p['rank_ecr'],'tier':p.get('tier'),'marketRank':market.get(str(p['player_id'])),'age':age,'birthDate':birth if position!='DST' else None,'sleeperId':sid,'bioTeam':bio.get('team'),'teamConflict':bool(bio.get('team') and bio['team']!=team),'injuryStatus':bio.get('injury_status'),'status':bio.get('status'),'bye':p.get('player_bye_week'),'managerInterest':trend,'sourceUrl':p['player_page_url']})
# Exclude ambiguous free-agent duplicate names rather than assign another person's bio.
active_names={(norm(p['name']),p['position']) for p in players if p['team']!='FA'}
excluded=[p['id'] for p in players if p['team']=='FA' and (norm(p['name']),p['position']) in active_names]
players=[p for p in players if p['id'] not in excluded]
assert len({p['id'] for p in players})==len(players)
metadata={'version':now.isoformat(),'season':2026,'scoring':'PPR','fetchedAt':now.isoformat(),'rankingUpdated':ecr['last_updated'],'experts':ecr['total_experts'],'sources':urls,'playerCount':len(players),'excludedAmbiguousEntries':excluded,'unmatchedBios':unmatched,'sentimentMethod':'Top-100 adds and drops over 24 hours: manager-interest proxy, not social sentiment. Missing list entries are unknown, not zero.'}
output={'metadata':metadata,'players':players}
path=ROOT/'src/current-rankings.json';temp=path.with_suffix('.tmp');temp.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n');temp.replace(path)
print(json.dumps({'players':len(players),'ageCoverage':sum(p['age'] is not None for p in players),'interestCoverage':sum(p['managerInterest'] is not None for p in players),'teamConflicts':sum(p['teamConflict'] for p in players),'unmatched':unmatched}))
