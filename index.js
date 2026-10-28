import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {homedir} from 'node:os';
import {defineTool} from '@deepseek-ai/dsh-tools';
import {createScope,scopeParentOf} from '@deepseek-ai/dsh-scope';
import {PROJECTS,WORKFLOWS,DEFAULTS,freshState,allowsTool,discoverableInProject,searchTools,advanceState,validateEstimate,guidance,editorIntegrations,projectCatalog,projectIntegrations,projectSkills,searchProjectSkills,PROJECT_SKILLS,VERSION,toolDenial} from './policy.js';

export const name='project-modes';
export const inject=['agents','tools','systemPrompt'];

/** All persisted state belongs to this plugin; no private session-log vocabulary. */
export function apply(ctx,config={}) {
  const file=config.stateFile || join(homedir(),'.dsh/project-modes/state.json');
  let database={version:1,sessions:{}};
  try { database=JSON.parse(readFileSync(file,'utf8')); if(database.version!==1 || !database.sessions || Array.isArray(database.sessions)) throw Error('Invalid project modes state.'); }
  catch(e) { if(e.code!=='ENOENT') throw e; }
  const save=()=>{mkdirSync(dirname(file),{recursive:true,mode:0o700});const temp=file+'.tmp';writeFileSync(temp,JSON.stringify(database,null,2)+'\n',{mode:0o600});renameSync(temp,file);};
  const installedSkills=()=>PROJECT_SKILLS.filter(skill=>{try{const source=readFileSync(join(config.skillRoot || join(homedir(),'.dsh/skills'),skill.name,'SKILL.md'),'utf8');const front=source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];return front?.match(/^name:\s*['"]?([a-z0-9-]+)['"]?\s*$/m)?.[1]===skill.name;}catch{return false;}}).map(skill=>skill.name);
  const bindings=new Map();
  const availableTools=agent=>[...new Map([...agent.ctx.tools.schemas(scopeParentOf(agent)),...agent.ctx.tools.schemas(agent)].map(tool=>[tool.name,tool])).values()];
  let refreshing=false,queued=false,disposed=false;
  const selected=agent=>database.sessions[agent.id] || freshState();
  const commit=(agent,state)=>{
    const previous=database.sessions[agent.id];
    database.sessions[agent.id]=state;
    try {save();} catch(e) {if(previous)database.sessions[agent.id]=previous;else delete database.sessions[agent.id];throw e;}
    refresh(agent);
  };
  function refresh(agent) {
    const binding=bindings.get(agent);
    if(!binding) return;
    refreshing=true;
    try {
      binding.lift?.();binding.lift=undefined;
      // Read the parent scope, which includes preset-owned tools but excludes
      // this agent's current mask and its own exempt registrations.
      const inherited=agent.ctx.tools.schemas(scopeParentOf(agent));
      const allow=inherited.map(t=>t.name).filter(n=>n!=='run_code' && allowsTool(n,selected(agent)));
      binding.lift=agent.ctx.tools.restrict({allow});
    } finally {refreshing=false;}
  }
  function attach(agent) {
    if(bindings.has(agent)) return;
    const parent=agent.session?.meta?.parentSession;
    if(!database.sessions[agent.id] && parent && database.sessions[parent]) {
      database.sessions[agent.id]=structuredClone(database.sessions[parent]);save();
    }
    bindings.set(agent,{});refresh(agent);
  }
  const remove=agent=>{const binding=bindings.get(agent);bindings.delete(agent);binding?.lift?.();};
  ctx.on('agent/created',({agent})=>{attach(agent);});
  ctx.on('agent/disposed',({agent})=>remove(agent));
  ctx.on('agent/status',({agent,status})=>{if(status==='idle')attach(agent);});
  // Reapply the same persisted selection on code reload, including running agents.
  // This changes no workflow or project; it prevents stale/unfiltered tool exposure.
  for(const agent of ctx.agents.list()) attach(agent);
  ctx.on('tools/change',()=>{
    if(refreshing || queued || disposed) return;
    queued=true;queueMicrotask(()=>{queued=false;if(disposed)return;for(const agent of bindings.keys())refresh(agent);});
  });
  ctx.effect(()=>ctx.tools.guard(exec=>{
    if(!exec.agent)return; // Guard persisted selections even while a running agent awaits reattachment after reload.
    return toolDenial(exec.name,exec.arguments,selected(exec.agent));
  }));
  ctx.effect(()=>ctx.systemPrompt.section({name:'project-modes:workflow',order:550,interpolate:false,text:({agent})=>agent && bindings.has(agent) ? guidance(selected(agent),{installedSkills:installedSkills()})+`\nCurrent project_stage revision: ${selected(agent).revision}.` : ''}));
  ctx.on('system-prompt/assemble',async(assembly,context,next)=>{
    const result=await next();const agent=context.agent;
    if(!agent || !bindings.has(agent))return result;
    const state=selected(agent);
    const tools=result.tools.filter(t=>allowsTool(t.name,state));
    const visible=new Set(tools.map(t=>t.name));
    return {...result,tools,sections:result.sections.filter(section=>{
      if(section.name.startsWith('mcp:'))return tools.some(t=>t.name.startsWith('mcp__'+section.name.slice(4)+'__'));
      if(section.name.startsWith('tool:'))return visible.has(section.name.slice(5));
      return true;
    })};
  });
  const estimateSchema={type:'object',additionalProperties:false,properties:{minutesLow:{type:'number',required:true},minutesHigh:{type:'number',required:true},assumptions:{type:'string',required:true},cost:{type:'string'}}};
  ctx.effect(()=>ctx.tools.register(defineTool({
    name:'project_stage',
    description:'Read workflow status, record a provisional project estimate, or advance exactly one completed stage. First show the user a concise stage summary/plan. Supply the revision from current workflow guidance; retries with an old revision cannot skip a stage. This tool cannot change the user-selected project or workflow. Act does not require further advancement.',
    parameters:{action:{type:'string',enum:['status','estimate','advance'],required:true},revision:{type:'integer'},summary:{type:'string'},estimate:estimateSchema},
    output:{schema:{type:'object',additionalProperties:false,properties:{status:{type:'string',required:true}}},render:(_args,value)=>[{type:'text',text:value.status}]},
    execute:async(args,exec)=>{
      const agent=exec.agent;if(!agent)throw Error('A live session is required.');
      const state=selected(agent);
      if(args.action==='status') {
        const all=availableTools(agent);
        const toolLoad={loadedBindings:all.filter(tool=>tool.name!=='run_code' && allowsTool(tool.name,state)).length,registered:all.filter(tool=>tool.name!=='run_code').length};
        return {status:JSON.stringify({...state,pluginVersion:VERSION,toolLoad,skills:projectSkills(state,installedSkills())})};
      }
      if(args.revision!==state.revision)throw Error('Workflow changed; call project_stage status and use its current revision.');
      const updated=args.action==='advance' ? advanceState(state,args) : {...state,estimate:validateEstimate(args.estimate),revision:state.revision+1};
      commit(agent,updated);
      return {status:JSON.stringify(updated)};
    },
  })));
  ctx.effect(()=>ctx.tools.register(defineTool({
    name:'project_tools',
    description:'Search installed tool names/descriptions and category skill entries without loading every schema. Skill matches include the real skill invocation and are not extra MCP tools. Inspect up to 3 exact eligible names to read their full input schemas. General can discover every installed specialist family; focused modes search within their family. In Act, enable up to 8 exact tool names for the next request; only the 12 most recently enabled extras stay loaded. Disable named extras or clear all extras when done to shrink subsequent requests. This cannot bypass research/planning stages or the boundary of a focused project mode.',
    parameters:{action:{type:'string',enum:['search','inspect','enable','disable','clear'],required:true},query:{type:'string'},names:{type:'array',items:{type:'string'}},revision:{type:'integer'}},
    output:{schema:{type:'object',additionalProperties:false,properties:{status:{type:'string',required:true}}},render:(_args,value)=>[{type:'text',text:value.status}]},
    execute:async(args,exec)=>{
      const agent=exec.agent;if(!agent)throw Error('A live session is required.');
      const state=selected(agent),available=availableTools(agent);
      const eligible=available.filter(t=>discoverableInProject(t.name,state.project));
      if(args.action==='inspect') {
        if(!Array.isArray(args.names) || !args.names.length || args.names.length>3 || args.names.some(name=>!eligible.some(tool=>tool.name===name)))throw Error('Inspect 1–3 exact tool names within the selected project.');
        const tools=args.names.map(name=>{const tool=eligible.find(tool=>tool.name===name);return {name:tool.name,description:tool.description,parameters:tool.parameters??tool.inputSchema};});
        return {status:JSON.stringify({pluginVersion:VERSION,project:state.project,stage:state.stage,tools})};
      }
      if(args.action==='search') {
        const matches=searchTools(available,args.query,state);
        return {status:JSON.stringify({pluginVersion:VERSION,category:projectCatalog(available,installedSkills()).find(project=>project.id===state.project),project:state.project,stage:state.stage,revision:state.revision,matches,skillMatches:searchProjectSkills(args.query,state,installedSkills())})};
      }
      if(state.stage!=='act' || state.project==='research')throw Error('Additional execution tools are available only in Act.');
      if(args.revision!==state.revision)throw Error('Workflow changed; refresh project_stage status.');
      if(args.action==='clear' || args.action==='disable') {
        if(args.action==='disable' && (!Array.isArray(args.names) || !args.names.length || args.names.length>12 || args.names.some(name=>!(state.enabled??[]).includes(name))))throw Error('Choose exact currently enabled extras to disable.');
        const removed=new Set(args.names??[]);
        const enabled=args.action==='clear'?[]:(state.enabled??[]).filter(name=>!removed.has(name));
        const updated={...state,enabled,revision:state.revision+1};commit(agent,updated);
        return {status:JSON.stringify({revision:updated.revision,enabled,availableOnNextRequest:true})};
      }
      if(!Array.isArray(args.names) || !args.names.length || args.names.length>8 || args.names.some(n=>!eligible.some(t=>t.name===n)))throw Error('Choose 1–8 exact available names within this project.');
      const requested=new Set(args.names);
      const enabled=[...(state.enabled??[]).filter(n=>!requested.has(n)),...requested].slice(-12);
      const updated={...state,enabled,revision:state.revision+1};commit(agent,updated);
      return {status:JSON.stringify({revision:updated.revision,enabled,availableOnNextRequest:true})};
    },
  })));
  const catalog=()=>({version:VERSION,projects:PROJECTS,workflows:WORKFLOWS,defaults:DEFAULTS});
  function snapshot(agent) {
    const state=selected(agent),all=availableTools(agent);
    return {...catalog(),projects:projectCatalog(all,installedSkills()),skills:projectSkills(state,installedSkills()),groups:projectIntegrations(all,state),registrationOnly:true,state,busy:agent.status!=='idle',counts:{selected:all.filter(t=>allowsTool(t.name,state)).length,total:all.length},integrations:editorIntegrations(all,state),specialists:all.filter(t=>!allowsTool(t.name,{...state,project:'general',stage:'act'}) && allowsTool(t.name,{...state,stage:'act'})).map(t=>t.name)};
  }
  async function audit() {
    const sample=ctx.agents.list()[0];
    if(!sample)throw Error('Open a session before checking mode assemblies.');
    const parent=scopeParentOf(sample),available=ctx.tools.schemas(parent);
    if(!available.some(t=>t.name==='read'))throw Error('DSH tools are still activating; retry shortly.');
    const rows=[];
    for(const project of PROJECTS)for(const workflow of WORKFLOWS)for(const stage of workflow.stages) {
      const key={},scope=createScope(ctx,key,{parent}),state={...freshState({project:project.id,workflow:workflow.id}),stage};
      const agent={id:'project-modes-audit',ctx:scope.ctx,status:'idle',session:{meta:{}}};
      // The actual host registry and assembly, isolated from every user session.
      const allow=ctx.tools.schemas(parent).map(t=>t.name).filter(n=>n!=='run_code' && allowsTool(n,state));
      let lift;
      try {
        lift=scope.ctx.tools.restrict({allow});
        const assembled=await ctx.systemPrompt.assemble({scope:key});
        const visible=assembled.tools.filter(t=>t.name!=='run_code').map(t=>t.name);
        if(visible.some(n=>!allowsTool(n,state)))throw Error('Unexpected tool in isolated assembly.');
        rows.push({project:project.id,workflow:workflow.id,stage,tools:visible.length});
      } finally {lift?.();await scope.dispose();}
    }
    return {passed:true,cases:rows.length,rows,availableTools:ctx.tools.schemas(scopeParentOf(ctx.agents.list()[0])).map(t=>t.name)};
  }
  ctx.inject(['webServer'],web=>web.effect(()=>web.webServer.register({kind:'prefix',path:'/api/project-modes',handler:async(req,res)=>{
    const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    try {
      // This longer-prefix route must explicitly use the app's existing admission.
      const connection=ctx.get('connection');
      if(!connection || typeof connection.admit!=='function')return send(503,{error:'DSH authentication is unavailable.'});
      const admission=connection.admit(req);
      if(admission?.rejection)return send(admission.rejection,{error:'Unauthorized request.'});
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET' && url.pathname==='/api/project-modes/tool-inventory') {
        const agent=ctx.agents.get(url.searchParams.get('sessionId')) || ctx.agents.list()[0];
        if(!agent)return send(503,{error:'Open a DSH session before inspecting tool registrations.'});
        const all=availableTools(agent);
        const general=freshState({project:'general',workflow:'act'});
        return send(200,{runtimePid:process.pid,registered:all.map(t=>t.name),generalAct:all.filter(t=>allowsTool(t.name,general)).map(t=>t.name),generalPlan:all.filter(t=>allowsTool(t.name,{...general,stage:'plan'})).map(t=>t.name),current:{project:selected(agent).project,stage:selected(agent).stage,tools:agent.ctx.tools.schemas(agent).map(t=>t.name)}});
      }
      if(req.method==='GET' && url.pathname==='/api/project-modes/categories') {
        const agent=ctx.agents.get(url.searchParams.get('sessionId')) || ctx.agents.list()[0];
        if(!agent)return send(503,{error:'Open a DSH session before inspecting tool categories.'});
        const all=availableTools(agent),state=selected(agent);
        return send(200,{runtimePid:process.pid,version:VERSION,categories:projectCatalog(all,installedSkills()),current:{project:state.project,stage:state.stage,groups:projectIntegrations(all,state),skills:projectSkills(state,installedSkills())},registrationOnly:true});
      }
      if(req.method==='GET' && url.pathname==='/api/project-modes/integrations') {
        const agent=ctx.agents.get(url.searchParams.get('sessionId')) || ctx.agents.list()[0];
        if(!agent)return send(503,{error:'Open a DSH session before inspecting editor registrations.'});
        const all=availableTools(agent);
        const act=freshState({project:'video-edit',workflow:'act'});
        return send(200,{runtimePid:process.pid,integrations:editorIntegrations(all,act),jianyingToolNames:all.filter(t=>t.name.startsWith('mcp__jianying__')).map(t=>t.name),legacyCapcutToolNames:all.filter(t=>t.name.startsWith('mcp__capcut__')).map(t=>t.name),premiereStartupTools:all.filter(t=>['mcp__premiere__get_capabilities','mcp__premiere__ping'].includes(t.name)).map(t=>t.name)});
      }
      if(req.method==='GET' && url.pathname==='/api/project-modes/audit')return send(200,await audit());
      if(url.pathname!=='/api/project-modes')return send(404,{error:'Unknown route.'});
      if(req.method==='GET') {
        const agent=ctx.agents.get(url.searchParams.get('sessionId'));
        return agent ? send(200,snapshot(agent)) : send(404,{error:'This session is not active.'});
      }
      if(req.method!=='POST')return send(405,{error:'Method not allowed.'});
      let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>16384)return send(413,{error:'Request too large.'});}
      const body=JSON.parse(raw);
      if(Object.keys(body).some(k=>!['sessionId','revision','project','workflow','reset'].includes(k)))return send(400,{error:'Unknown setting.'});
      const agent=ctx.agents.get(body.sessionId);
      if(!agent)return send(404,{error:'This session is not active.'});
      if(agent.status!=='idle')return send(409,{error:'Wait for the current response to finish before switching modes.'});
      const current=selected(agent);
      if(body.revision!==current.revision)return send(409,{error:'Modes changed in another window. Reopen the control.'});
      if(body.reset!==undefined && typeof body.reset!=='boolean')return send(400,{error:'Invalid reset value.'});
      const project=body.project??current.project,workflow=body.workflow??current.workflow;
      const initial=freshState({project,workflow});
      const state=workflow!==current.workflow || body.reset ? {...initial,revision:current.revision+1} : {...current,project,enabled:project===current.project ? current.enabled??[] : [],revision:current.revision+1};
      commit(agent,state);attach(agent);
      return send(200,snapshot(agent));
    } catch(e) {return send(400,{error:e.message || 'Could not update project modes.'});}
  }})));
  ctx.effect(()=>()=>{disposed=true;for(const agent of [...bindings.keys()])remove(agent);});
}
