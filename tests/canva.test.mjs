import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,inProject,allowsTool,projectIntegrations} from '../policy.js';
const state=project=>freshState({project,workflow:'act'});
test('Canva belongs to Office and Images, but creative actions stay on demand',()=>{
 for(const project of ['office','image-docs']){
  assert(inProject('mcp__canva__create-design',project));
  assert(!allowsTool('mcp__canva__create-design',state(project)));
  assert(allowsTool('mcp__canva__create-design',{...state(project),enabled:['mcp__canva__create-design']}));
  assert(allowsTool('mcp__canva__help',state(project)));
 }
 for(const project of ['video-edit','cad'])assert(!allowsTool('mcp__canva__create-design',{...state(project),enabled:['mcp__canva__create-design']}));
});
test('Canva registrations remain separate from default-loaded actions and connection health',()=>{
 const tools=['mcp__canva__help','mcp__canva__create-design','mcp__canva__export-design'].map(name=>({name}));
 const group=projectIntegrations(tools,state('office')).find(g=>g.id==='canva');
 assert.equal(group.registered,3);assert.equal(group.loaded,1);assert(group.registrationOnly);assert(!('connected' in group));
});
