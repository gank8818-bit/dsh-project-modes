import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allowsTool,freshState,EDITOR_STARTER,toolDenial} from '../policy.js';
const state=freshState({project:'video-edit',workflow:'act'});
test('observed 92-binding editor request shrinks to 20 configured default bindings',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/exposed-video-tools.json',import.meta.url),'utf8'));
 assert.equal(fixture.observedBindings,92);
 const after=fixture.names.filter(name=>allowsTool(name,state));
 assert.equal(after.length,20);
 assert.equal(after.filter(name=>name.startsWith('mcp__premiere__')||name.startsWith('mcp__jianying__')).length,3);
 assert.equal(EDITOR_STARTER.size,3);
});
test('optional native helpers remain discoverable on demand without bloating focused defaults',()=>{
 for(const name of ['list_agents','schedule_create','get_goal','list_mcp_resources']){
  assert(!allowsTool(name,state),name);
  assert(allowsTool(name,{...state,enabled:[name]}),name);
  assert(allowsTool(name,freshState({project:'general',workflow:'act'})),name);
 }
 assert.match(toolDenial('mcp__jianying__batch_edit',{},state),/not loaded/);
 assert.doesNotMatch(toolDenial('mcp__jianying__batch_edit',{},state),/Workflow stage/);
});
