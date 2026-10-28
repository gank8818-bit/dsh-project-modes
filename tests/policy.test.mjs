import test from 'node:test';
import assert from 'node:assert/strict';
import {PROJECTS,WORKFLOWS,freshState,allowsTool,advanceState,validateEstimate,toolDenial} from '../policy.js';

test('specialist tools are isolated and All tools is explicit',()=>{
  const names={video:'video_render','video-edit':'mcp__premiere__trim_clip',cad:'mcp__blender__execute_code',desktop:'mcp__zavora__desktop_control'};
  for(const [project,name] of Object.entries(names))for(const option of PROJECTS){
    const state={...freshState({project:option.id,workflow:'act'}),enabled:[name]};
    const expected=option.id==='general' || option.id==='all' || option.id===project || (name==='video_render' && option.id==='video-edit') || name==='mcp__zavora__desktop_control';
    assert.equal(allowsTool(name,state),expected,option.id+' / '+name);
  }
});
test('research, ask and plan retain inspection tools while blocking typed mutations and desktop input',()=>{
  for(const project of PROJECTS)for(const workflow of WORKFLOWS)for(const stage of workflow.stages.filter(x=>x!=='act')){
    const state={...freshState({project:project.id,workflow:workflow.id}),stage};
    for(const name of ['write','video_render','mcp__premiere__trim_clip'])assert.equal(allowsTool(name,state),false);
    for(const name of ['read','web_search','ask_user_question','project_stage','mcp__zavora__desktop_control'])assert.equal(allowsTool(name,state),true);
    assert.equal(allowsTool('bash',state),state.project!=='research');
    assert.equal(toolDenial('mcp__zavora__desktop_control',{action:'observe'},state),undefined);
    assert.match(toolDenial('mcp__zavora__desktop_control',{action:'click'},state),/observation only/);
  }
});
test('workflow advances sequentially and requires an estimate before Act',()=>{
  let state=freshState({project:'video',workflow:'research-ask-plan-act'});
  state=advanceState(state,{summary:'Researched current toolchain.'});assert.equal(state.stage,'ask');
  state=advanceState(state,{summary:'Brief already specifies deadline and scope.'});assert.equal(state.stage,'plan');
  assert.throws(()=>advanceState(state,{summary:'Plan ready.'}),/estimate|time range/);
  state=advanceState(state,{summary:'Create and verify a short clip.',estimate:{minutesLow:10,minutesHigh:30,assumptions:'Toolchain installed; rendering queue uncertain.'}});
  assert.equal(state.stage,'act');assert.equal(state.revision,3);assert.equal(state.history.length,3);
  assert.throws(()=>advanceState(state,{summary:'Skip again.'}),/Already in Act/);
});
test('invalid selections and fabricated negative/reversed estimates fail',()=>{
  assert.throws(()=>freshState({project:'unknown',workflow:'act'}));
  for(const pair of [[-1,10],[30,10],[0,Infinity]])assert.throws(()=>validateEstimate({minutesLow:pair[0],minutesHigh:pair[1],assumptions:'test'}));
  assert.throws(()=>validateEstimate({minutesLow:1,minutesHigh:2,assumptions:''}));
});
test('Research project remains read-only in Act and unknown tools fail closed outside All',()=>{
  const state=freshState({project:'research',workflow:'act'});
  assert.equal(allowsTool('bash',state),false);
  assert.equal(allowsTool('web_fetch',state),true);
  assert.equal(allowsTool('mcp__new_server__mutate',freshState({project:'general',workflow:'act'})),false);
  assert.equal(allowsTool('mcp__new_server__mutate',freshState({project:'all',workflow:'act'})),true);
});
