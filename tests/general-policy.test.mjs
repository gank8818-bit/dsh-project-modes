import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,allowsTool,toolDenial,guidance,searchTools} from '../policy.js';
const general=freshState({project:'general',workflow:'act'});
test('General restores desktop, coordination, job control, workflow, goals and MCP resources',()=>{
  for(const name of ['mcp__zavora__desktop_control','spawn_teammate','send_message','list_agents','wait_agent','interrupt_agent','subagent_fork','team_task_create','team_task_list','team_task_get','team_task_update','job_list','job_kill','workflow','get_goal','create_goal','update_goal','list_mcp_resources','list_mcp_resource_templates','read_mcp_resource','schedule_create','schedule_list','schedule_update','schedule_delete'])assert(allowsTool(name,general),name);
  for(const name of ['mcp__premiere__trim_clip','mcp__jianying__batch_edit','remotion_render','mcp__blender__execute_code'])assert(!allowsTool(name,general),name);
});
test('the six logged General failures now have an available inspection or Act route',()=>{
  const failures=[['Bash','plan',{}],['mcp__zavora__desktop_control','act',{action:'open_browser'}],['Bash','research',{}],['Bash','plan',{}],['mcp__zavora__desktop_control','act',{action:'windows'}],['Bash','plan',{}]];
  for(const [name,stage,args] of failures){const state={...general,stage};assert(allowsTool(name,state));assert.equal(toolDenial(name,args,state),undefined);}
  assert.match(guidance({...general,stage:'plan'}),/shell only for read-only inspection/);
  assert.match(guidance({...general,stage:'plan'}),/including temporary diagnostic scripts/);
});
test('desktop observation is usable before Act but desktop input stays blocked',()=>{
  for(const stage of ['research','ask','plan']){
    const state={...general,stage};
    for(const action of ['windows','bind','observe','release'])assert.equal(toolDenial('mcp__zavora__desktop_control',{action},state),undefined);
    for(const action of ['click','key','type','open_browser','close_browser','resume'])assert.match(toolDenial('mcp__zavora__desktop_control',{action},state),/requires Act/);
  }
  assert.equal(toolDenial('mcp__zavora__desktop_control',{action:'click'},general),undefined);
  assert.match(toolDenial('mcp__zavora__desktop_control',{action:'click'},{...general,project:'research'}),/observation only/);
});
test('failures identify workflow restrictions separately from excluded specialist tools',()=>{
  assert.match(toolDenial('write',{}, {...general,stage:'plan'}),/Workflow stage plan/);
  assert.match(toolDenial('mcp__premiere__trim_clip',{},general),/not loaded.*project_tools/);
  assert.equal(toolDenial('Bash',{},general),undefined);
  assert(allowsTool('Read',{...general,stage:'plan'}));
});

test('General discovery ranks real multi-keyword queries and loads only requested extras',()=>{
  const tools=[{name:'mcp__zavora__desktop_control',description:'Observe and control native apps'},{name:'brewreel_render',description:'Render a video project'},{name:'web_fetch',description:'Fetch a web page'},{name:'bash',description:'Run shell commands'}];
  assert.equal(searchTools(tools,'zavora desktop control browser screenshot click',general)[0].name,'mcp__zavora__desktop_control');
  assert.equal(searchTools(tools,'brewreel render validate video',general)[0].name,'brewreel_render');
  assert.equal(searchTools(tools,'fetch web research network',general)[0].name,'web_fetch');
  assert(!allowsTool('brewreel_render',general));
  assert(allowsTool('brewreel_render',{...general,enabled:['brewreel_render']}));
  assert(!allowsTool('mcp__premiere__trim_clip',{...general,enabled:['brewreel_render']}));
  assert(!allowsTool('brewreel_render',{...general,stage:'plan',enabled:['brewreel_render']}));
});

test('a child can report its structured result during any workflow stage',()=>{
 for(const stage of ['research','ask','plan','act'])assert(allowsTool('structured_output',{...general,stage}));
});
