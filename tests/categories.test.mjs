import test from 'node:test';
import assert from 'node:assert/strict';
import {PROJECTS,freshState,allowsTool,inProject,projectCatalog,projectIntegrations,searchTools} from '../policy.js';
const state=project=>freshState({project,workflow:'act'});
test('generation and timeline editing no longer leak into each other',()=>{
 for(const name of ['brewreel_render','remotion_render','video_generate','mcp__video__create']){
  assert(allowsTool(name,state('video')),name);assert(!allowsTool(name,state('video-edit')),name);
 }
 for(const name of ['mcp__premiere__trim_clip','mcp__jianying__batch_edit','video_trim']){
  assert(!allowsTool(name,state('video-edit')),name);assert(allowsTool(name,{...state('video-edit'),enabled:[name]}),name);assert(!allowsTool(name,state('video')),name);
 }
 for(const name of ['media_probe','mcp__ffmpeg__extract_frame','video_render']){
  assert(allowsTool(name,state('video')));assert(!allowsTool(name,state('video-edit')));assert(allowsTool(name,{...state('video-edit'),enabled:[name]}));assert(!allowsTool(name,state('cad')));
 }
});
test('Onshape FeatureScript, Blender and local CAD namespaces remain CAD-only',()=>{
 for(const name of ['mcp__onshape__test_featurescript','mcp__onshape_fs__get_featurescript','mcp__blender__get_scene_info','mcp__cadquery__inspect','mcp__build123d__export_step']){
  assert(allowsTool(name,state('cad')),name);
  for(const project of ['video','video-edit','office','image-docs'])assert(!allowsTool(name,{...state(project),enabled:[name]}),project+' '+name);
 }
 assert(!inProject('mcp__onshape_evil__mutate','cad'));
 assert(!inProject('mcp__capcut__create_draft','video-edit'));
});
test('Office and graphics categories are explicit, with intentional PDF and image support',()=>{
 assert(PROJECTS.some(p=>p.id==='office'));assert(PROJECTS.some(p=>p.id==='image-docs'));
 for(const name of ['mcp__powerpoint__create_presentation','xlsx_read']){assert(!allowsTool(name,state('office')));assert(allowsTool(name,{...state('office'),enabled:[name]}));assert(!allowsTool(name,state('cad')));}
 assert(!allowsTool('svg_render',state('image-docs')));assert(allowsTool('svg_render',{...state('image-docs'),enabled:['svg_render']}));assert(!allowsTool('svg_render',state('office')));
 for(const project of ['office','image-docs']){assert(!allowsTool('pdf_extract',state(project)));assert(allowsTool('pdf_extract',{...state(project),enabled:['pdf_extract']}));}
 assert(allowsTool('generate_image',state('video')));assert(!allowsTool('generate_image',state('image-docs')));assert(allowsTool('generate_image',{...state('image-docs'),enabled:['generate_image']}));
 assert(!allowsTool('generate_image',state('video-edit')));
});
test('category counts exclude shared core tools and deduplicate registrations',()=>{
 const tools=['read','bash','mcp__zavora__desktop_control','mcp__onshape__test_featurescript','mcp__onshape__test_featurescript','mcp__premiere__ping','mcp__premiere__apply_effect'].map(name=>({name}));
 const catalog=projectCatalog(tools);
 assert.equal(catalog.find(p=>p.id==='cad').registeredSpecialists,1);
 assert.equal(catalog.find(p=>p.id==='video-edit').registeredSpecialists,2);
 assert.equal(catalog.find(p=>p.id==='office').registeredSpecialists,0);
 const groups=projectIntegrations(tools,state('cad'));
 assert.deepEqual(groups.find(g=>g.id==='onshape'),{id:'onshape',label:'Onshape / FeatureScript',support:false,registered:1,loaded:1,registrationOnly:true});
 assert.equal(groups.find(g=>g.id==='desktop').support,true);
 assert.equal(projectIntegrations(tools,{...state('cad'),stage:'plan'}).find(g=>g.id==='onshape').loaded,0);
 assert(!groups.some(g=>'connected' in g || 'healthy' in g));
});
test('Chinese category aliases are searchable without broadening a focused mode',()=>{
 const tools=['mcp__jianying__check_environment','mcp__blender__get_scene_info','mcp__onshape__test_featurescript','mcp__powerpoint__create_presentation'].map(name=>({name,description:''}));
 assert.equal(searchTools(tools,'剪映',state('video-edit'))[0].name,'mcp__jianying__check_environment');
 assert.equal(searchTools(tools,'幻灯片',state('office'))[0].name,'mcp__powerpoint__create_presentation');
 assert.equal(searchTools(tools,'剪映',state('cad')).length,0);
});
