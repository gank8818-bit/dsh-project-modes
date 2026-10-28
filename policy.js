import {specialistInProject,familySearchText,integrationGroups} from './families.js';

export const PROJECTS = [
  {id:'general', label:'General', description:'Everyday tools, desktop control and coordination, with specialist tools loaded on demand.'},
  {id:'video', label:'Video gen', description:'Video creation, Remotion and media generation tools.'},
  {id:'video-edit', label:'Video editing', description:'Adobe Premiere Pro and Chinese Jianying / 剪映 MCP tools.'},
  {id:'cad', label:'AI CAD', description:'Onshape / FeatureScript, Blender and other registered CAD tools. Files, shell and Zavora support remain available; registration is not a live-connection check.'},
  {id:'office', label:'PPT / Office', description:'Registered presentation, Word, Excel and PDF tools. No Office integration is installed merely by selecting this mode.'},
  {id:'image-docs', label:'Images / SVG / PDF', description:'Registered image generation/editing, vector graphics and PDF tools, with Zavora support when needed.'},
  {id:'web-design', label:'Web / UX / 3D', description:'UX-first creative websites through the installed creative-web skill: files, local development, interactive 3D and guarded browser verification. This is not a connected Framer/Spline MCP.'},
  {id:'research', label:'Research', description:'Web search and reading tools only.'},
  {id:'desktop', label:'Desktop', description:'Zavora desktop control, files and shell.'},
  {id:'all', label:'All tools', description:'Explicitly include every installed tool family.'},
];
export const WORKFLOWS = [
  {id:'research-plan-act', label:'Research → Plan → Act', stages:['research','plan','act']},
  {id:'plan-act', label:'Plan → Act', stages:['plan','act']},
  {id:'act', label:'Act', stages:['act']},
  {id:'research-ask-plan-act', label:'Research → Ask → Plan → Act', stages:['research','ask','plan','act']},
];
export const READ_TOOLS = new Set(['read','read_image','glob','grep','web_search','web_fetch','skill','ask_user_question','project_stage','project_tools','exit_plan_mode','list_mcp_resources','list_mcp_resource_templates','read_mcp_resource','list_agents','wait_agent','team_task_list','team_task_get','list_subagent_models','structured_output','schedule_list','get_goal','job_list','job_output','job_status','job_wait','mcp__zavora__desktop_control']);
// Shell remains available for inspection outside Act, under workflow guidance
// and the existing sandbox/approval policy. Do not pretend to classify arbitrary
// shell programs as read-only by parsing their command strings.
const SHELL_TOOLS = new Set(['bash','pwsh']);
const CORE_TOOLS = new Set([...READ_TOOLS,...SHELL_TOOLS,'write','edit','str_replace_editor','todo_write','todo_read','present','present_file','load_workspace_dependencies','jobs','job_cancel','job_kill','spawn_teammate','subagent','subagent_fork','spawn_agent','send_message','interrupt_agent','team_task_create','team_task_update','schedule_create','schedule_update','schedule_delete','workflow','create_goal','update_goal']);
const TOOL_ALIASES = new Map([['Bash','bash'],['Read','read'],['Write','write'],['Edit','edit'],['Glob','glob'],['Grep','grep'],['Skill','skill'],['WebSearch','web_search'],['WebFetch','web_fetch'],['TodoWrite','todo_write'],['AskUserQuestion','ask_user_question'],['ExitPlanMode','exit_plan_mode']]);
export const canonicalToolName = name => TOOL_ALIASES.get(name) ?? name;
const DESKTOP_OBSERVATION_ACTIONS = new Set(['windows','bind','observe','release']);
export const VERSION='1.4.0';
export const FOCUSED_CORE = new Set(['read','read_image','glob','grep','skill','ask_user_question','write','edit','bash','todo_write','present','project_stage','project_tools','mcp__zavora__desktop_control','job_list','job_output','job_kill','structured_output']);
export const EDITOR_STARTER = new Set(['mcp__premiere__get_capabilities','mcp__premiere__ping','mcp__jianying__check_environment']);
export const DEFAULTS = Object.freeze({project:'general', workflow:'plan-act'});
export function editorIntegrations(tools,state) {
  return [{id:'premiere',label:'Premiere Pro'},{id:'jianying',label:'剪映 / Jianying'}].map(editor=>{
    const registered=tools.filter(tool=>tool.name.startsWith('mcp__'+editor.id+'__'));
    return {...editor,registered:registered.length,loaded:registered.filter(tool=>allowsTool(tool.name,state)).length};
  });
}
export function projectIntegrations(tools,state) {
  return integrationGroups(tools,state,allowsTool);
}
export const PROJECT_SKILLS = [
  {name:'creative-web',label:'Creative Web · UX-first / 3D',projects:['web-design'],description:'UX-first local website workflow: user tasks, information architecture, scroll animation and interactive 3D. Browser acceptance is separate.',keywords:'creative-web website frontend UX UI three gsap scroll animation 网页 网站 交互 用户体验 三维'}
];
export function projectSkills(state,installedNames=[]) {
  const installed=new Set(installedNames);
  return PROJECT_SKILLS.filter(skill=>installed.has(skill.name) && (state.project==='all' || skill.projects.includes(state.project))).map(({projects,keywords,...skill})=>({...skill,kind:'skill',installed:true,invocation:{tool:'skill',arguments:{name:skill.name}}}));
}
export function searchProjectSkills(query,state,installedNames=[]) {
  const words=String(query??'').toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];
  return projectSkills(state,installedNames).filter(skill=>{const meta=PROJECT_SKILLS.find(x=>x.name===skill.name);const text=[skill.name,skill.label,skill.description,meta.keywords].join(' ').toLowerCase();return !words.length || words.some(word=>text.includes(word));});
}
export function projectCatalog(tools,installedNames=[]) {
  const catalog=[...new Map(tools.map(tool=>[tool.name,tool])).values()];
  return PROJECTS.map(project=>({...project,skills:projectSkills({project:project.id},installedNames),registeredSpecialists:catalog.filter(tool=>!CORE_TOOLS.has(canonicalToolName(tool.name)) && !/^(?:job_|jobs_|pty_)/.test(tool.name) && inProject(tool.name,project.id)).length}));
}
export function inProject(name,project) {
  name=canonicalToolName(name);
  return project==='all' || CORE_TOOLS.has(name) || /^(?:job_|jobs_|pty_)/.test(name) || specialistInProject(name,project);
}
export const discoverableInProject = (name,project) => project==='general' || inProject(name,project);
export function searchTools(tools,query,state) {
  const text=(query??'').trim().toLowerCase();
  const words=[...new Set(text.match(/[\p{L}\p{N}]+/gu)??[])];
  return tools.filter(tool=>discoverableInProject(tool.name,state.project)).map(tool=>{
    const name=tool.name.toLowerCase(),description=String(tool.description??'').toLowerCase(),aliases=familySearchText(tool.name);
    const score=words.length ? (name===text?1000:0)+(name.includes(text)?100:0)+words.reduce((sum,word)=>sum+(name.includes(word)?8:aliases.includes(word)?3:description.includes(word)?1:0),0) : allowsTool(tool.name,state)?1:0;
    return {tool,score};
  }).filter(x=>!words.length || x.score>0).sort((a,b)=>b.score-a.score || a.tool.name.localeCompare(b.tool.name)).slice(0,10).map(({tool})=>({name:tool.name,description:String(tool.description??'').slice(0,600),loaded:allowsTool(tool.name,state)}));
}
export function freshState(selection=DEFAULTS) {
  const workflow=WORKFLOWS.find(x=>x.id===selection.workflow);
  if (!workflow || !PROJECTS.some(x=>x.id===selection.project)) throw new Error('Unknown project or workflow mode.');
  return {project:selection.project,workflow:workflow.id,stage:workflow.stages[0],revision:0,estimate:null,history:[],enabled:[]};
}
export function allowsTool(name,state) {
  name=canonicalToolName(name);
  if (name==='run_code') return true; // Transport only; its inner dispatch still passes the guard.
  if (state.project==='research') return READ_TOOLS.has(name);
  if (state.stage!=='act') return READ_TOOLS.has(name) || SHELL_TOOLS.has(name);
  if(state.project==='general')return CORE_TOOLS.has(name) || /^(?:job_|jobs_|pty_)/.test(name) || (state.enabled??[]).slice(-12).includes(name);
  if(!inProject(name,state.project))return false;
  if(state.project==='all')return true;
  if(CORE_TOOLS.has(name) || /^(?:job_|jobs_|pty_)/.test(name))return FOCUSED_CORE.has(name) || (state.enabled??[]).includes(name);
  if(state.project==='video-edit')return EDITOR_STARTER.has(name) || (state.enabled??[]).includes(name);
  if(['office','image-docs'].includes(state.project))return name==='mcp__canva__help' || (state.enabled??[]).includes(name);
  return true;
}
export function toolDenial(name,args,state) {
  const canonical=canonicalToolName(name);
  if(!allowsTool(canonical,state)) {
    if(state.stage==='act' && state.project!=='research' && discoverableInProject(canonical,state.project))return `Tool "${name}" is not loaded in ${state.project} yet. Use project_tools search and enable only the tools needed next; clear or disable extras after use.`;
    if(inProject(canonical,state.project) || (state.project==='general' && state.stage!=='act'))return `Workflow stage ${state.stage} blocks tool "${name}". Use inspection tools now, or complete the current stage before Act. This is a workflow restriction, not a missing General tool.`;
    return state.project==='general' ? `Tool "${name}" is not loaded in General yet. Use project_tools search and enable for the specific tool; General keeps up to 12 specialist extras loaded.` : `Project toolset ${state.project} excludes specialist tool "${name}". Choose the matching project toolset beside the prompt box.`;
  }
  if(canonical==='mcp__zavora__desktop_control' && (state.stage!=='act' || state.project==='research') && !DESKTOP_OBSERVATION_ACTIONS.has(args?.action))return `Workflow stage ${state.stage} permits desktop observation only (windows, bind, observe, release). Desktop action "${String(args?.action)}" requires Act in a project that permits changes.`;
  return undefined;
}
export function validateEstimate(value) {
  if (!value || typeof value!=='object' || !Number.isFinite(value.minutesLow) || !Number.isFinite(value.minutesHigh) || value.minutesLow<0 || value.minutesHigh<value.minutesLow || value.minutesHigh>525600) throw new Error('Estimate needs a valid low/high duration in minutes.');
  if (typeof value.assumptions!=='string' || !value.assumptions.trim() || value.assumptions.length>4000) throw new Error('State the estimate assumptions and uncertainty.');
  if (value.cost!==undefined && (typeof value.cost!=='string' || value.cost.length>1000)) throw new Error('Invalid cost estimate.');
  return {minutesLow:value.minutesLow,minutesHigh:value.minutesHigh,assumptions:value.assumptions.trim(),cost:value.cost?.trim() || 'Unknown; verify provider credits before paid generation.'};
}
export function advanceState(state,{summary,estimate}) {
  if (typeof summary!=='string' || !summary.trim() || summary.length>6000) throw new Error('Summarize the completed stage before advancing.');
  const stages=WORKFLOWS.find(x=>x.id===state.workflow).stages;
  const at=stages.indexOf(state.stage);
  if(at===stages.length-1) throw new Error('Already in Act. Complete the work and report the result.');
  const nextEstimate=estimate===undefined ? state.estimate : validateEstimate(estimate);
  if(state.stage==='plan' && !nextEstimate) throw new Error('Provide a project time range, cost/credit assumptions and uncertainty before Act.');
  return {...state,stage:stages[at+1],estimate:nextEstimate,revision:state.revision+1,history:[...state.history,{stage:state.stage,summary:summary.trim(),at:new Date().toISOString()}].slice(-20)};
}
export function guidance(state,{installedSkills=[]}={}) {
  const project=PROJECTS.find(x=>x.id===state.project);
  const flow=WORKFLOWS.find(x=>x.id===state.workflow);
  const instructions={
    research:'Research the task and inspect relevant evidence. Use web, reading and inspection tools; do not implement or generate assets. Summarize findings and sources, then call project_stage(action="advance", summary=...).',
    ask:'Identify missing requirements, scope, budget/credit limits and deadline. Use ask_user_question when an answer is needed and wait for the real response. If the brief already answers these, say so without inventing answers. Then summarize the clarified brief with project_stage(action="advance", summary=...).',
    plan:'Present concise steps, deliverables, dependencies and a realistic duration range. Explain assumptions, uncertainty and any unknown cost/credit use; estimates are not guarantees. No implementation in this stage. Once the plan is concrete, call project_stage(action="advance", summary=..., estimate={minutesLow,minutesHigh,assumptions,cost}) and continue to Act. Ask for approval only when the task or existing policy requires it.',
    act:'Carry out the selected project, verify the actual output and report the result. Use project_tools for additional capabilities rather than routing around a hidden specialist through shell. In General, discover and enable the specific specialist tools needed; focused project modes stay within their own tool families. Do not claim a CAD/generation integration exists when its tools are absent.',
  };
  const editors=state.project==='video-edit' ? 'Video editing starts with only three MCP discovery/health tools. Use project_tools to enable the exact read/edit/export tools needed next, then clear or disable extras after the step. Optional coordination, scheduling and resource helpers are on demand in focused Act modes. Video editing is a tool group backed by real MCP connectors. For Chinese 剪映 use mcp__jianying__check_environment first, then inspect the managed project before creating a new named revision. Prefer batch_edit for related edits. The international CapCut runtime is not the Chinese Jianying integration. Load the video-editor-mcp skill before editor work. For Premiere start with get_capabilities and ping; do not claim a live connection from registration alone. Native Jianying opening/rendering remains unverified until checked in the app; it has no native automatic export tool. Visible UI actions must use guarded Zavora, with exact window binding and fresh observations. Do not overwrite existing drafts or bypass the quit-app/index-backup checks for publish_draft.' : '';
  const cad=state.project==='cad' ? 'For Onshape prefer the official MCP/API for structured geometry operations when it is authenticated and connected; use Zavora for login and necessary UI steps. Web UI and API authentication are distinct. Respect API rate/allocation limits and document privacy; do not bypass security challenges. A TLS timeout is not proof of bot prevention. Never claim a subscription or registered schema proves live connectivity.' : '';
  const web=state.project==='web-design' ? (installedSkills.includes('creative-web') ? 'For website and UX tasks, first call skill with {name:"creative-web"}. Use its UX-first flow: user/context/task, information architecture and journeys, interaction/error/recovery states, design tradeoffs, then implementation and evidence-based acceptance. The installed skill uses local files/CLI, not Framer/Spline/Webflow MCP. File/shell actions remain stage-bound; use only Zavora for visible UI, respect STOP and do not equate build/HTTP checks with browser or user validation.' : 'This category provides file/CLI and Zavora support, but creative-web is not detected. Do not claim an absent skill or Framer/Spline bridge is installed.') : '';
  const inspection='During Research, Ask and Plan, use shell only for read-only inspection: do not write files (including temporary diagnostic scripts), start or stop services, install software or make implementation changes. Use existing read/grep/glob tools where possible. Desktop control in these stages permits windows, bind, observe and release only; opening browsers, clicks, keys and typing require Act. In Act, General includes desktop control without switching to Desktop. Tool availability never grants permission to contact others, create goals or delegate beyond the user\'s request.';
  const discovery=state.project==='general' ? 'General discovery searches every installed tool family without loading their schemas. In Act, enable only the exact specialist tools needed; at most 12 extras remain loaded. Use a focused project mode when most of the task belongs to that specialty.' : 'Use project_tools to discover additional tools within the selected project; in Act, enable only the specific tools needed for the next step. Focused toolsets stay within their tool family.';
  return `Project toolset: ${project.label}. ${project.description}\nWorkflow: ${flow.label}. Current stage: ${state.stage.toUpperCase()}.\n${instructions[state.stage]}\n${inspection}\n${editors}\n${cad}\n${web}\n${discovery}\nStages are sequential. project_stage records progress and activates the next stage for the next model request. The user can restart or switch this workflow beside the prompt box. An explicit Act workflow calls for direct execution without a separate plan/estimate. These workflow choices never change sandbox, approval, authentication, or desktop STOP policy.\n${state.estimate ? 'Current provisional estimate: '+JSON.stringify(state.estimate) : ''}\n${state.history.length ? 'Completed stage summaries: '+JSON.stringify(state.history) : ''}`;
}
