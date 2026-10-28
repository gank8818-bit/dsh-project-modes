import test from 'node:test';
import assert from 'node:assert/strict';
import {allowsTool,inProject,freshState,editorIntegrations,guidance} from '../policy.js';
const editing=freshState({project:'video-edit',workflow:'act'});
test('Chinese Jianying operations and Premiere discovery are real video-editing capabilities',()=>{
  for(const name of ['check_environment','read_managed_project','create_draft','batch_edit','publish_draft','extract_frame']) {
    const tool='mcp__jianying__'+name;
    assert(inProject(tool,'video-edit'));assert.equal(allowsTool(tool,editing),name==='check_environment');assert(allowsTool(tool,{...editing,enabled:[tool]}));
    assert(!allowsTool(tool,freshState({project:'general',workflow:'act'})));
    assert(!allowsTool(tool,{...editing,stage:'plan'}));
  }
  for(const tool of ['mcp__premiere__get_capabilities','mcp__premiere__ping','mcp__zavora__desktop_control'])assert(allowsTool(tool,editing));
  assert(!inProject('mcp__capcut__create_draft','video-edit'));
  assert(!allowsTool('mcp__premiere__apply_effect',editing)); // Still discovered on demand.
});
test('registration counts stay distinct from stage-loaded tools and do not claim connectivity',()=>{
  const tools=['mcp__premiere__ping','mcp__premiere__apply_effect','mcp__jianying__check_environment','mcp__jianying__batch_edit','mcp__capcut__create_draft'].map(name=>({name}));
  assert.deepEqual(editorIntegrations(tools,editing).map(x=>[x.id,x.registered,x.loaded]),[['premiere',2,1],['jianying',2,1]]);
  assert.deepEqual(editorIntegrations(tools,{...editing,stage:'plan'}).map(x=>x.loaded),[0,0]);
  assert.match(guidance(editing),/check_environment first/);
  assert.match(guidance(editing),/no native automatic export/);
});
