window.__ModuleLoader__.load({id:'dsh-project-modes',factory:(require)=>{
  const React=require('react');
  const h=React.createElement;
  const css=`
  .dsh-modes-chip{font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary,inherit);border:1px solid var(--dsw-alias-border-l2,#8884);border-radius:16px;background:transparent;max-width:230px;height:28px;padding:0 9px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dsh-modes-chip:hover,.dsh-modes-chip[aria-expanded=true]{background:var(--dsw-alias-fill-l2,#8882)}
  .dsh-modes-panel{position:fixed;z-index:10000;box-sizing:border-box;width:320px;max-width:calc(100vw - 24px);padding:14px;border:1px solid var(--dsw-alias-border-l2,#8885);border-radius:14px;background:var(--dsw-alias-background-elevated,var(--dsw-static-neutral-50,#fff));color:var(--dsw-alias-label-primary,#222);box-shadow:0 8px 32px #0002;font-size:12px;line-height:1.5;max-height:70vh;overflow:auto}
  body[data-ds-dark-theme] .dsh-modes-panel{background:var(--dsw-static-neutral-850,#242424);color:var(--dsw-alias-label-primary,#eee)}
  .dsh-modes-panel header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-size:13px;font-weight:600}
  .dsh-modes-panel label{display:block;margin-top:10px;font-weight:500}
  .dsh-modes-panel select{box-sizing:border-box;display:block;width:100%;margin-top:4px;padding:6px 8px;border:1px solid #8885;border-radius:8px;color:inherit;background:inherit;font:inherit}
  .dsh-modes-panel option{color:CanvasText;background:Canvas}
  .dsh-modes-panel p{margin:6px 0;color:var(--dsw-alias-label-secondary,inherit)}
  .dsh-modes-stage{display:flex;gap:4px;flex-wrap:wrap;margin:12px 0 6px}
  .dsh-modes-stage span{border-radius:6px;padding:2px 6px;background:#8881;text-transform:capitalize}
  .dsh-modes-stage [aria-current=step]{background:#4889ff22;color:var(--dsw-alias-state-business-primary,#3672cf);font-weight:600}
  .dsh-modes-panel button{font:inherit;cursor:pointer;color:inherit;background:transparent;border:1px solid #8884;border-radius:6px;padding:3px 7px}
  .dsh-modes-panel button:disabled,.dsh-modes-panel select:disabled{opacity:.5;cursor:wait}
  .dsh-modes-error{color:#d34545!important}.dsh-modes-estimate{border-top:1px solid #8883;padding-top:8px;margin-top:10px}
  .dsh-modes-chip:focus-visible,.dsh-modes-panel :focus-visible{outline:2px solid #4889ff;outline-offset:2px}
  .dsh-modes-sets{border:0;margin:10px 0 0;padding:0}
  .dsh-modes-sets legend{display:flex;width:100%;align-items:center;justify-content:space-between;padding:0;font-weight:500}
  .dsh-modes-combine{display:inline-flex!important;align-items:center;gap:5px;margin:0!important;font-weight:400!important;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer}
  .dsh-modes-combine input{margin:0;accent-color:#4889ff}
  .dsh-modes-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px}
  .dsh-modes-panel .dsh-modes-set{display:flex;align-items:center;gap:6px;text-align:left;padding:5px 8px;border-radius:8px;min-height:28px;line-height:1.25}
  .dsh-modes-set .dsh-modes-mark{flex:none;display:inline-grid;place-items:center;width:14px;height:14px;border:1.5px solid #8888;font-size:10px;line-height:1}
  .dsh-modes-set[role=radio] .dsh-modes-mark{border-radius:50%}.dsh-modes-set[role=checkbox] .dsh-modes-mark{border-radius:4px}
  .dsh-modes-panel .dsh-modes-set[aria-checked=true]{border-color:#4889ff;background:#4889ff1a;color:var(--dsw-alias-state-business-primary,#3672cf);font-weight:600}
  .dsh-modes-set[aria-checked=true] .dsh-modes-mark{border-color:#4889ff;background:#4889ff;color:#fff}
  .dsh-modes-hint{font-size:11px}
  `;
  async function request(sessionId,change,signal) {
    const result=await fetch('/api/project-modes'+(change?'':'?sessionId='+encodeURIComponent(sessionId)),{
      credentials:'same-origin',signal,headers:{'Content-Type':'application/json'},
      ...(change?{method:'POST',body:JSON.stringify({sessionId,...change})}:{})
    });
    const data=await result.json();if(!result.ok)throw Error(data.error||'Could not load project modes.');return data;
  }
  function ModeControl({modeSession}) {
    const [data,setData]=React.useState(null),[open,setOpen]=React.useState(false),[error,setError]=React.useState(''),[saving,setSaving]=React.useState(false),[position,setPosition]=React.useState({});
    const button=React.useRef(null),panel=React.useRef(null),latest=React.useRef(null),busyRef=React.useRef(false);
    React.useEffect(()=>{
      const controller=new AbortController();let active=true;
      const load=()=>request(modeSession,null,controller.signal).then(d=>{if(active && !busyRef.current && (!latest.current || d.state.revision>=latest.current.state.revision)){setData(d);latest.current=d;setError('');}}).catch(e=>{if(active && e.name!=='AbortError')setError(e.message);});
      setData(null);latest.current=null;setOpen(false);load();
      const timer=setInterval(load,2500);
      return()=>{active=false;controller.abort();clearInterval(timer);};
    },[modeSession]);
    React.useEffect(()=>{
      if(!open)return;
      const outside=e=>{if(!panel.current?.contains(e.target) && !button.current?.contains(e.target))setOpen(false);};
      const key=e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);button.current?.focus();}};
      document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
      const close=()=>setOpen(false);window.addEventListener('resize',close);
      return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);window.removeEventListener('resize',close);};
    },[open]);
    const update=async change=>{
      if(!latest.current || busyRef.current)return;
      busyRef.current=true;setSaving(true);setError('');
      try{const d=await request(modeSession,{revision:latest.current.state.revision,...change});setData(d);latest.current=d;}
      catch(e){setError(e.message);}
      finally{busyRef.current=false;setSaving(false);}
    };
    const state=data?.state,project=data?.projects.find(x=>x.id===state.project),workflow=data?.workflows.find(x=>x.id===state.workflow);
    const max=data?.maxCombo ?? 1;
    const chosen=state ? (Array.isArray(state.projects) && state.projects[0]===state.project ? state.projects : [state.project]) : [];
    const labelOf=id=>data?.projects.find(x=>x.id===id)?.label ?? id;
    // Default is one toolset (single choice). "Combine" switches the grid to multi-select, up to `max`.
    const [combine,setCombine]=React.useState(false);
    React.useEffect(()=>{if(chosen.length>1)setCombine(true);},[chosen.length]);
    const choose=id=>{
      if(!combine)return id===chosen[0] && chosen.length===1 ? undefined : update({project:id}); // single choice keeps the 1.4 request shape
      if(chosen.includes(id))return chosen.length>1 ? update({projects:chosen.filter(x=>x!==id)}) : undefined;
      if(id==='all' || chosen.includes('all'))return update({projects:[id]}); // All tools already covers everything
      if(chosen.length<max)return update({projects:[...chosen,id]});
    };
    const toggleCombine=()=>{if(combine && chosen.length>1)update({projects:[chosen[0]]});setCombine(!combine);};
    const chipText=state ? (chosen.length>1 ? `${labelOf(chosen[0])} +${chosen.length-1}` : project.label) : '';
    const disabled=saving || data?.busy;
    const estimate=state?.estimate;
    const availableGroups=data?.groups?.filter(group=>group.loaded>0) ?? [];
    const availableSkills=data?.skills ?? [];
    return h(React.Fragment,null,
      h('button',{ref:button,type:'button',className:'dsh-modes-chip','aria-label':'Project tools and workflow','aria-expanded':open,'aria-haspopup':'dialog',title:data?`${chosen.map(labelOf).join(' + ')} · ${workflow.label} · ${state.stage}\n${data.counts.selected} tools available`:'Project tools and workflow',onClick:()=>{
        const r=button.current.getBoundingClientRect();setPosition({left:Math.max(12,Math.min(r.left,window.innerWidth-332)),bottom:window.innerHeight-r.top+8});setOpen(!open);
      }},state?`${chipText} · ${state.stage[0].toUpperCase()+state.stage.slice(1)} ▾`:'Modes ▾'),
      open?h('section',{ref:panel,role:'dialog','aria-label':'Project tools and workflow',className:'dsh-modes-panel',style:position},
        h('header',null,'Project modes',h('button',{type:'button','aria-label':'Close project modes',onClick:()=>{setOpen(false);button.current?.focus();}},'×')),
        data?h(React.Fragment,null,
          h('fieldset',{className:'dsh-modes-sets'},
            h('legend',null,h('span',null,combine?`Tools · ${chosen.length}/${max}`:'Tools'),
              max>1?h('label',{className:'dsh-modes-combine',title:`Combine up to ${max} toolsets in this chat`},h('input',{type:'checkbox','aria-label':`Combine up to ${max} toolsets`,checked:combine,disabled,onChange:toggleCombine}),`Combine (max ${max})`):null),
            h('div',{className:'dsh-modes-grid',role:combine?'group':'radiogroup','aria-label':'Project toolsets'},data.projects.map(x=>{
              const on=chosen.includes(x.id),at=chosen.indexOf(x.id);
              const full=combine && !on && chosen.length>=max && x.id!=='all' && !chosen.includes('all');
              // In a combo the mark shows the selection order (1 = primary); the label stays readable in a 2-column grid.
              const order=combine && on && chosen.length>1;
              return h('button',{key:x.id,type:'button',role:combine?'checkbox':'radio','aria-checked':on,className:'dsh-modes-set',disabled:disabled || full,title:full?`Up to ${max} toolsets; remove one first`:order?`${at===0?'Primary':'Added #'+(at+1)} · ${x.description}`:x.description,onClick:()=>choose(x.id)},
                h('span',{className:'dsh-modes-mark','aria-hidden':true},on?(order?String(at+1):combine?'✓':'●'):''),x.label);
            })),
            combine?h('p',{className:'dsh-modes-hint'},chosen.length>=max?`Maximum ${max} reached. Untick one to swap.`:`Tick up to ${max}; their tools load together.`):null),
          availableGroups.length ? h('p',{'aria-label':'Available tool integrations'},'Available: '+availableGroups.map(group=>group.label).join(' · ')) : null,
          availableSkills.length ? h('p',{'aria-label':'Available skills'},'Skills: '+availableSkills.map(skill=>skill.label+' ('+skill.name+')').join(' · ')) : null,
          h('label',null,'Workflow',h('select',{'aria-label':'Workflow stages',value:state.workflow,disabled,onChange:e=>update({workflow:e.target.value})},data.workflows.map(x=>h('option',{key:x.id,value:x.id},x.label)))),
          h('div',{className:'dsh-modes-stage','aria-label':'Workflow progress'},workflow.stages.map((stage,i)=>h('span',{key:stage,'aria-current':stage===state.stage?'step':undefined},`${i+1} ${stage}`))),
          h('p',null,`${data.counts.selected} tools available in this stage`),
          data.busy?h('p',null,'Switch modes after the current response finishes.'):null,
          h('button',{type:'button',disabled,onClick:()=>update({reset:true})},'Restart workflow'),
          h('div',{className:'dsh-modes-estimate'},estimate?h(React.Fragment,null,h('strong',null,`Estimate: ${estimate.minutesLow}–${estimate.minutesHigh} min`),h('p',null,estimate.assumptions),h('p',null,estimate.cost)):h('p',null,state.workflow==='act'?'Direct execution. No separate planning stage.':'The Plan stage will add a time range and cost assumptions here.'))
        ):h('p',null,'Loading modes…'),
        error?h('p',{className:'dsh-modes-error',role:'alert'},error):null
      ):null
    );
  }
  return {inject:['slots'],apply(ctx){
    ctx.effect(()=>{
      const style=document.createElement('style');style.dataset.plugin='dsh-project-modes';style.textContent=css;document.head.appendChild(style);return()=>style.remove();
    });
    ctx.slots.inject('conversation.input.left',()=>ctx.slots.register({name:'conversation.input.left',id:'dsh-project-modes',inject:sessionId=>({modeSession:sessionId})},ModeControl));
  }};
}});
