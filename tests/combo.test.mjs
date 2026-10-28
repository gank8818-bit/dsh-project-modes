import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {apply} from '../index.js';
import {freshState,allowsTool,toolDenial,guidance,normalizeProjects,projectsOf,MAX_COMBO,projectIntegrations} from '../policy.js';

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

const withDir=async fn=>{const dir=mkdtempSync(join(tmpdir(),'dsh-combo-'));try{await fn(join(dir,'state.json'));}finally{rmSync(dir,{recursive:true,force:true});}};

test('default selection is exactly one toolset and the limit is three',()=>{
  const s=freshState();assert.deepEqual(s.projects,['general']);assert.equal(s.project,'general');assert.equal(MAX_COMBO,3);
  assert.deepEqual(normalizeProjects(['video','video-edit','cad']),['video','video-edit','cad']);
  assert.throws(()=>normalizeProjects([]),/1–3/);
  assert.throws(()=>normalizeProjects(['video','video-edit','cad','office']),/1–3/);
  assert.throws(()=>normalizeProjects(['video','video']),/once/);
  assert.throws(()=>normalizeProjects(['all','video']),/alone/);
  assert.throws(()=>normalizeProjects(['nope']),/Unknown/);
});
test('a combo loads the union of its toolsets and nothing else',()=>{
  const act=projects=>({...freshState({projects,workflow:'act'})});
  const cadOnly=act(['cad']),videoEdit=act(['video-edit']),combo=act(['cad','video-edit']);
  assert(allowsTool('mcp__blender__execute_code',cadOnly));assert(!allowsTool('mcp__blender__execute_code',videoEdit));
  assert(allowsTool('mcp__premiere__ping',combo));assert(allowsTool('mcp__blender__execute_code',combo));
  assert(!allowsTool('mcp__canva__generate-design',combo));
  assert.match(toolDenial('mcp__canva__generate-design',{},combo),/toolsets cad \+ video-edit exclude .*up to 3/);
  assert.match(toolDenial('mcp__premiere__trim_clip',{},combo),/not loaded in cad \+ video-edit/);
  const groups=projectIntegrations([{name:'mcp__premiere__ping'},{name:'mcp__blender__x'}],combo).map(g=>g.id);
  assert(groups.includes('premiere') && groups.includes('blender'));
});
test('stage rules apply to every member and Research alone stays read-only',()=>{
  const plan={...freshState({projects:['cad','video-edit'],workflow:'plan-act'})};
  assert(!allowsTool('write',plan));assert(!allowsTool('mcp__blender__execute_code',plan));assert(allowsTool('read',plan));
  const research={...freshState({projects:['research'],workflow:'act'})};
  assert(!allowsTool('write',research));
  const researchDesktop={...freshState({projects:['research','desktop'],workflow:'act'})};
  assert(allowsTool('write',researchDesktop));
  assert.equal(toolDenial('mcp__zavora__desktop_control',{action:'click'},researchDesktop),undefined);
  assert.match(toolDenial('mcp__zavora__desktop_control',{action:'click'},research),/observation only/);
});
test('older single-project states and overridden primaries stay compatible',()=>{
  assert.deepEqual(projectsOf({project:'cad'}),['cad']);
  assert.deepEqual(projectsOf({...freshState({projects:['cad','video'],workflow:'act'}),project:'research'}),['research']);
});
test('guidance names every combined toolset and its specialist rules',()=>{
  const text=guidance({...freshState({projects:['video-edit','cad'],workflow:'act'})});
  assert.match(text,/Combined toolsets \(2 of max 3\): Video editing \+ AI CAD/);
  assert.match(text,/Video editing starts with only three MCP/);assert.match(text,/For Onshape prefer/);
  assert.match(guidance(freshState()),/^Project toolset: General\./);
});
test('the API selects, persists and validates combos per session',()=>withDir(async file=>{
  const f=fixture(file);
  let r=await f.api({sessionId:'a',revision:0,projects:['cad','video-edit'],workflow:'act'});
  assert.equal(r.status,200);assert.deepEqual(r.value.state.projects,['cad','video-edit']);assert.equal(r.value.maxCombo,3);
  assert(f.masks.get('a').includes('mcp__blender__execute_code'));assert(f.masks.get('a').includes('mcp__premiere__ping'));
  assert(!f.masks.get('a').includes('mcp__premiere__trim_clip'));assert(!f.masks.get('b').includes('mcp__blender__execute_code'));
  assert.deepEqual(fixture(file).state('a').projects,['cad','video-edit']);
  assert.equal((await f.api({sessionId:'a',revision:1,projects:['cad','video-edit','office','video']})).status,400);
  assert.equal((await f.api({sessionId:'a',revision:1,projects:['all','cad']})).status,400);
  assert.equal((await f.api({sessionId:'a',revision:1,project:'cad',projects:['cad']})).status,400);
  assert.deepEqual(f.state('a').projects,['cad','video-edit']);
  r=await f.api({sessionId:'a',revision:1,project:'research'});
  assert.equal(r.status,200);assert.deepEqual(r.value.state.projects,['research']);
}));
test('enabled extras survive a combo change only while still discoverable',()=>withDir(async file=>{
  const f=fixture(file);
  await f.api({sessionId:'a',revision:0,projects:['video-edit'],workflow:'act'});
  await f.call('project_tools',{action:'enable',revision:1,names:['mcp__premiere__trim_clip']});
  assert.deepEqual(f.state('a').enabled,['mcp__premiere__trim_clip']);
  await f.api({sessionId:'a',revision:2,projects:['video-edit','cad']});
  assert.deepEqual(f.state('a').enabled,['mcp__premiere__trim_clip']);assert(f.masks.get('a').includes('mcp__premiere__trim_clip'));
  await f.api({sessionId:'a',revision:3,projects:['cad']});
  assert.deepEqual(f.state('a').enabled,[]);
  await f.api({sessionId:'a',revision:4,projects:['cad','video-edit']});
  const search=JSON.parse((await f.call('project_tools',{action:'search',query:'premiere trim'})).status);
  assert.deepEqual(search.projects,['cad','video-edit']);assert(search.matches.some(m=>m.name==='mcp__premiere__trim_clip'));
}));
