import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createApp} from './app.js';

test('PostgreSQL round trip, concurrent writes, validation, and restart persistence', {skip: !process.env.TEST_DATABASE_URL}, async () => {
  const pool = new pg.Pool({connectionString: process.env.TEST_DATABASE_URL});
  // Use a dedicated test database: this test clears its workspace table.
  let server;
  try {
    const app = await createApp(pool);
    await pool.query('TRUNCATE workspace');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/state`;
    const put = body => fetch(url, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    assert.deepEqual(await (await fetch(url)).json(), {state:null,revision:0});
    const state={players:[{id:'p1',name:'Test'}],picks:[{playerId:'p1',team:1}],settings:{teams:12,rounds:16,slot:5},watched:['p1'],preferences:{view:'Draft board'},custom:true,beforeRankings:{players:[]}};
    assert.equal((await put({state,revision:0})).status,200);
    assert.deepEqual((await (await fetch(url)).json()).state,state);
    assert.equal((await put({state,revision:0})).status,409);
    const results=await Promise.all([put({state:{...state,watched:[]},revision:1}),put({state,revision:1})]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    assert.equal((await put({state:{},revision:2})).status,400);
    const cross=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json',Origin:'https://elsewhere.example'},body:JSON.stringify({state,revision:2})});
    assert.equal(cross.status,403);
    await new Promise(resolve=>server.close(resolve));
    server=(await createApp(pool)).listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    const persisted=await (await fetch(`http://127.0.0.1:${server.address().port}/api/state`)).json();
    assert.equal(persisted.revision,2);
    assert.deepEqual(persisted.state.picks,state.picks);
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));
    await pool.end();
  }
});
