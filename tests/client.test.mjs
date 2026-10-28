import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {VERSION,WORKFLOWS,projectCatalog,projectIntegrations,freshState} from '../policy.js';
function render(project,{busy=false,stage='act',skills=[]}={}){
 const state={...freshState({project,workflow:'act'}),stage};
 const tools=['read','bash','mcp__zavora__desktop_control','mcp__premiere__ping','mcp__jianying__check_environment'].map(name=>({name}));
 const data={version:VERSION,state,busy,skills,projects:projectCatalog(tools),workflows:WORKFLOWS,counts:{selected:3,total:5},groups:projectIntegrations(tools,state)};
 let component,definition,stateCall=0,refCall=0;
 const React={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props??{},children:children.flat(Infinity)}),useState:initial=>[[data,true,'',false,{}][stateCall++],()=>{}],useRef:initial=>({current:++refCall===3?data:initial}),useEffect:()=>{}};
 const document={createElement:()=>({dataset:{},remove(){}}),head:{appendChild(){}}};
 vm.runInNewContext(readFileSync(new URL('../client.source.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:value=>definition=value}},document,AbortController,setInterval,clearInterval,fetch:()=>{throw Error('A render must not mutate settings');}});
 definition.factory(name=>{assert.equal(name,'react');return React;}).apply({effect:fn=>fn(),slots:{inject:(_name,fn)=>fn(),register:(_spec,value)=>component=value}});
 return component({modeSession:'test-session'});
}
const nodes=tree=>[tree,...tree.children.filter(child=>child && typeof child==='object').flatMap(nodes)];
const text=tree=>tree.children.map(child=>typeof child==='object' && child?text(child):child??'').join(' ');
test('mode picker shows available integrations without registration clutter',()=>{
 const tree=render('video-edit'),all=nodes(tree);
 const select=all.find(n=>n.type==='select' && n.props['aria-label']==='Project toolset');
 assert(select.children.some(option=>option.props.value==='office'));
 assert(select.children.some(option=>option.props.value==='image-docs'));
 assert(select.children.some(option=>option.props.value==='web-design'));
 assert(select.children.every(option=>!text(option).includes('registered')));
 assert.match(text(tree),/Available: Premiere Pro · 剪映 \/ Jianying/);
 assert.match(text(tree),/3 tools available in this stage/);
 assert.doesNotMatch(text(tree),/registered|registration|loaded|1\.3\.0|3 \/ 5/i);
 assert.match(all.find(n=>n.type==='button').props.title,/3 tools available/);
});
test('unavailable integrations stay hidden while available desktop support remains visible',()=>{
 const tree=render('cad');
 assert.doesNotMatch(text(tree),/Onshape|CadQuery|registered|registration|connectivity|connection checks/i);
 assert.match(text(tree),/Available:/);
});
test('busy response still disables project and workflow changes',()=>{
 const tree=render('video-edit',{busy:true});
 for(const select of nodes(tree).filter(n=>n.type==='select'))assert.equal(select.props.disabled,true);
 assert.match(text(tree),/Switch modes after the current response finishes/);
});

test('Web picker lists an installed skill separately from tool integrations',()=>{
 const tree=render('web-design',{skills:[{name:'creative-web',label:'Creative Web · UX-first / 3D'}]});
 const entry=nodes(tree).find(n=>n.props['aria-label']==='Available skills');assert(entry);assert.match(text(entry),/creative-web/);assert.match(text(tree),/Web \/ UX \/ 3D/);assert.doesNotMatch(text(tree),/Framer|Spline|connected|registered/);
 assert(!nodes(render('web-design')).some(n=>n.props['aria-label']==='Available skills'));
});
