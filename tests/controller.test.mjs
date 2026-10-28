import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,realpathSync,mkdirSync} from 'node:fs';
import {freshState,VERSION} from '../policy.js';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {apply} from '../index.js';

function fixture(file,own=[],status='idle',skillRoot=join(dirname(file),'skills')) {
  const catalog=['read','skill','write','bash','web_search','ask_user_question','mcp__premiere__ping','mcp__premiere__get_capabilities','mcp__jianying__check_environment','mcp__premiere__trim_clip','mcp__premiere__apply_effect','mcp__blender__execute_code','mcp__zavora__desktop_control',...Array.from({length:16},(_,i)=>'mcp__test__extra_'+i)].map(name=>({name,description:name,parameters:{type:'object'}}));
  const registered=new Map(),listeners=new Map(),masks=new Map();let route,guard;
  const tools={schemas:scope=>[...catalog,...registered.values(),...(scope?own:[])],guard:fn=>{guard=fn;return()=>{};},register:t=>{registered.set(t.name,t);return()=>registered.delete(t.name);}};
  const agents=['a','b'].map(id=>({id,status,session:{meta:{}},ctx:{tools:{...tools,restrict:filter=>{masks.set(id,filter.allow);return()=>masks.delete(id);}}}}));
  const web={webServer:{register:r=>{route=r.handler;return()=>{};}},effect:fn=>fn()};
  const ctx={agents:{list:()=>agents,get:id=>agents.find(a=>a.id===id)},tools,systemPrompt:{section:()=>()=>{}},on:(name,fn)=>listeners.set(name,fn),effect:fn=>fn(),inject:(_deps,fn)=>fn(web),get:()=>({admit:req=>req.authorized?{}:{rejection:401}})};
  apply(ctx,{stateFile:file,skillRoot});
  const api=async(body,authorized=true)=>{
    const req={method:'POST',url:'/api/project-modes',authorized,async *[Symbol.asyncIterator](){yield JSON.stringify(body);}};
    let status,value;
    const res={writeHead:s=>status=s,end:s=>value=JSON.parse(s)};await route(req,res);return{status,value};
  };
  const call=async(name,args,id='a')=>registered.get(name).execute(args,{agent:agents.find(a=>a.id===id),signal:new AbortController().signal});
  const get=async(path,authorized=true)=>{let status,value;await route({method:'GET',url:path,authorized},{writeHead:s=>status=s,end:s=>value=JSON.parse(s)});return {status,value};};
  return{api,get,call,agents,masks,guard:exec=>guard(exec),state:id=>JSON.parse(readFileSync(file,'utf8')).sessions[id]};
}
test('mode switching is session-local, persists, and rejects stale or busy writes',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'dsh-modes-')),file=join(dir,'state.json');
  try {
    const f=fixture(file);
    assert(!f.masks.get('a').includes('write'));
    let result=await f.api({sessionId:'a',revision:0,project:'video-edit',workflow:'act'});
    assert.equal(result.status,200);assert(!f.masks.get('a').includes('mcp__premiere__trim_clip'));assert(f.masks.get('a').includes('mcp__premiere__ping'));
    assert(!f.masks.get('a').includes('mcp__blender__execute_code'));assert(!f.masks.get('b').includes('write'));
    assert.equal((await f.api({sessionId:'a',revision:0,project:'all'})).status,409);
    f.agents[0].status='running';assert.equal((await f.api({sessionId:'a',revision:1,project:'all'})).status,409);
    assert.equal(f.state('a').project,'video-edit');f.agents[0].status='idle';
    assert.equal(fixture(file).state('a').project,'video-edit');
    assert.equal((await f.api({sessionId:'a',revision:1,project:'all'},false)).status,401);
    assert.equal(f.state('a').project,'video-edit');
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('stage tool requires current revision and estimate, then exposes Act tools',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'dsh-modes-'));
  try {
    const f=fixture(join(dir,'state.json'));
    await assert.rejects(f.call('project_stage',{action:'advance',revision:0,summary:'Ready'}),/estimate|time range/);
    await f.call('project_stage',{action:'advance',revision:0,summary:'Compute and verify.',estimate:{minutesLow:1,minutesHigh:2,assumptions:'Small local task; no remote queue.'}});
    assert.equal(f.state('a').stage,'act');assert(f.masks.get('a').includes('write'));
    await assert.rejects(f.call('project_stage',{action:'advance',revision:0,summary:'Retry'}),/Workflow changed/);
    assert.equal(f.state('a').stage,'act');
    assert.match(f.guard({name:'mcp__blender__execute_code',agent:f.agents[0]}),/not loaded/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('on-demand discovery cannot cross project boundaries or activate during Plan',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'dsh-modes-'));
  try {
    const f=fixture(join(dir,'state.json'));
    await assert.rejects(f.call('project_tools',{action:'enable',revision:0,names:['write']}),/only in Act/);
    await f.api({sessionId:'a',revision:0,project:'video-edit',workflow:'act'});
    const search=JSON.parse((await f.call('project_tools',{action:'search',query:'apply effect'})).status);
    assert.equal(search.matches[0].name,'mcp__premiere__apply_effect');assert.equal(search.matches[0].loaded,false);
    await assert.rejects(f.call('project_tools',{action:'enable',revision:1,names:['mcp__blender__execute_code']}),/within this project/);
    await f.call('project_tools',{action:'enable',revision:1,names:['mcp__premiere__apply_effect']});
    assert(f.masks.get('a').includes('mcp__premiere__apply_effect'));
    assert.equal(f.guard({name:'mcp__premiere__apply_effect',agent:f.agents[0]}),undefined);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('General enables specialist extras on demand with a rolling twelve-tool cap',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'dsh-modes-'));
  try {
    const f=fixture(join(dir,'state.json'));
    assert(f.masks.get('a').includes('bash'));
    assert.equal(f.guard({name:'mcp__zavora__desktop_control',arguments:{action:'observe'},agent:f.agents[0]}),undefined);
    assert.match(f.guard({name:'mcp__zavora__desktop_control',arguments:{action:'click'},agent:f.agents[0]}),/observation only/);
    await f.api({sessionId:'a',revision:0,workflow:'act'});
    assert.equal(f.guard({name:'mcp__zavora__desktop_control',arguments:{action:'click'},agent:f.agents[0]}),undefined);
    const search=JSON.parse((await f.call('project_tools',{action:'search',query:'blender model CAD'})).status);
    assert(search.matches.some(t=>t.name==='mcp__blender__execute_code' && !t.loaded));
    const names=Array.from({length:16},(_,i)=>'mcp__test__extra_'+i);
    await f.call('project_tools',{action:'enable',revision:1,names:names.slice(0,8)});
    await f.call('project_tools',{action:'enable',revision:2,names:names.slice(8,16)});
    assert.equal(f.state('a').enabled.length,12);
    assert(!f.masks.get('a').includes(names[0]));assert(f.masks.get('a').includes(names[15]));
    assert(!f.masks.get('a').includes('mcp__blender__execute_code'));
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('General discovery includes tools registered in the chat scope',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'dsh-modes-'));
  try {
    const f=fixture(join(dir,'state.json'),[{name:'mcp__scope__specialist',description:'A chat-local capability',parameters:{type:'object'}}]);
    await f.api({sessionId:'a',revision:0,workflow:'act'});
    const search=JSON.parse((await f.call('project_tools',{action:'search',query:'scope specialist'})).status);
    assert(search.matches.some(t=>t.name==='mcp__scope__specialist' && !t.loaded));
    await f.call('project_tools',{action:'enable',revision:1,names:['mcp__scope__specialist']});
    assert.equal(f.guard({name:'mcp__scope__specialist',arguments:{},agent:f.agents[0]}),undefined);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('running-agent reload reapplies the persisted category mask without switching modes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'dsh-modes-reload-'));try{
  const file=join(dir,'state.json');writeFileSync(file,JSON.stringify({version:1,sessions:{a:freshState({project:'cad',workflow:'act'})}}));
  const f=fixture(file,[],'running');assert(f.masks.has('a'));assert(!f.masks.get('a').includes('mcp__premiere__trim_clip'));assert.equal(f.state('a').project,'cad');
  assert.match(f.guard({name:'mcp__premiere__trim_clip',arguments:{},agent:f.agents[0]}),/excludes/);
  assert.equal(f.guard({name:'read',arguments:{},agent:f.agents[0]}),undefined);
 }finally{assert(realpathSync(dir).startsWith(realpathSync(tmpdir())+'/dsh-modes-reload-'));rmSync(dir,{recursive:true,force:true});}
});
test('category diagnostics are authenticated read-only metadata, not a mode switch',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dsh-modes-catalog-'));try{
  const f=fixture(join(dir,'state.json'));
  assert.equal((await f.get('/api/project-modes/categories',false)).status,401);
  const result=await f.get('/api/project-modes/categories?sessionId=a');
  assert.equal(result.status,200);assert.equal(result.value.version,VERSION);assert(result.value.registrationOnly);
  assert(result.value.categories.some(p=>p.id==='office'));
  assert.equal(JSON.parse((await f.call('project_stage',{action:'status'})).status).project,'general');
 }finally{assert(realpathSync(dir).startsWith(realpathSync(tmpdir())+'/dsh-modes-catalog-'));rmSync(dir,{recursive:true,force:true});}
});

test('enabled editing extras can be disabled or cleared without changing modes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dsh-modes-unload-'));
 try{
  const f=fixture(join(dir,'state.json'));await f.api({sessionId:'a',revision:0,project:'video-edit',workflow:'act'});
  await f.call('project_tools',{action:'enable',revision:1,names:['mcp__premiere__trim_clip','mcp__premiere__apply_effect']});
  assert(f.masks.get('a').includes('mcp__premiere__trim_clip'));
  await assert.rejects(f.call('project_tools',{action:'disable',revision:2,names:['read']}),/currently enabled/);
  await f.call('project_tools',{action:'disable',revision:2,names:['mcp__premiere__apply_effect']});
  assert(!f.masks.get('a').includes('mcp__premiere__apply_effect'));
  await assert.rejects(f.call('project_tools',{action:'clear',revision:2}),/Workflow changed/);
  await f.call('project_tools',{action:'clear',revision:3});
  assert(!f.masks.get('a').includes('mcp__premiere__trim_clip'));
  assert(f.masks.get('a').includes('mcp__premiere__ping'));
  const status=JSON.parse((await f.call('project_stage',{action:'status'})).status);
  assert.equal(status.project,'video-edit');assert.deepEqual(status.enabled,[]);assert.equal(status.pluginVersion,VERSION);assert(status.toolLoad.loadedBindings<status.toolLoad.registered);
 }finally{assert(realpathSync(dir).startsWith(realpathSync(tmpdir())+'/dsh-modes-unload-'));rmSync(dir,{recursive:true,force:true});}
});

test('schema inspection is bounded, read-only and project-scoped',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dsh-modes-inspect-'));try{
  const parameters={type:'object',properties:{brief:{type:'string'}},required:['brief']};
  const f=fixture(join(dir,'state.json'),[{name:'mcp__scope__specialist',description:'Schema fixture',parameters}]);
  const result=JSON.parse((await f.call('project_tools',{action:'inspect',names:['mcp__scope__specialist']})).status);
  assert.deepEqual(result.tools[0].parameters,parameters);assert(!f.masks.get('a').includes('mcp__scope__specialist'));
  await assert.rejects(f.call('project_tools',{action:'inspect',names:Array(4).fill('read')}),/1–3/);
  await f.api({sessionId:'a',revision:0,project:'cad',workflow:'act'});
  await assert.rejects(f.call('project_tools',{action:'inspect',names:['mcp__premiere__trim_clip']}),/selected project/);
 }finally{assert(realpathSync(dir).startsWith(realpathSync(tmpdir())+'/dsh-modes-inspect-'));rmSync(dir,{recursive:true,force:true});}
});

test('Web category exposes an actually installed skill without registering an MCP or changing other sessions',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dsh-modes-web-'));try{
  const skills=join(dir,'skills'),file=join(skills,'creative-web','SKILL.md');mkdirSync(dirname(file),{recursive:true});writeFileSync(file,'---\nname: creative-web\n---\n# Real local skill\n'.replaceAll('\\n','\n'));
  const f=fixture(join(dir,'state.json'));const before=JSON.parse((await f.call('project_stage',{action:'status'})).status).toolLoad.registered;
  await f.api({sessionId:'a',revision:0,project:'web-design',workflow:'act'});
  const snap=(await f.get('/api/project-modes?sessionId=a')).value;
  assert.equal(snap.skills[0].name,'creative-web');assert.equal(snap.skills[0].kind,'skill');assert.equal(snap.skills[0].invocation.tool,'skill');assert.equal(snap.groups.find(g=>g.id==='desktop').loaded,1);
  const search=JSON.parse((await f.call('project_tools',{action:'search',query:'网页 UX'})).status);assert.equal(search.skillMatches[0].name,'creative-web');
  const state=JSON.parse((await f.call('project_stage',{action:'status'})).status);assert.equal(state.toolLoad.registered,before);assert.equal(state.project,'web-design');assert(!f.state('b'));assert(f.masks.get('a').includes('skill'));assert(!f.masks.get('a').includes('mcp__premiere__ping'));
  writeFileSync(file,'---\nname: not-creative-web\n---\n'.replaceAll('\\n','\n'));assert.equal((await f.get('/api/project-modes?sessionId=a')).value.skills.length,0);
 }finally{assert(realpathSync(dir).startsWith(realpathSync(tmpdir())+'/dsh-modes-web-'));rmSync(dir,{recursive:true,force:true});}
});
