// Capability routing is explicit. Registration is not proof of a live connection.
export const TOOL_FAMILIES = [
  {id:'video-generation',label:'Video generation · BrewReel / Remotion',projects:['video'],keywords:'video generation brewreel remotion 精酿 视频生成 动画',pattern:/^(?:brewreel|remotion|hyperframes|video_(?:generate|create|storyboard|animate)|mcp__(?:video|brewreel|remotion|hyperframes|seedance|kling|sora|veo)__)/i},
  {id:'media',label:'Media inspection / rendering utilities',projects:['video','video-edit'],keywords:'media ffmpeg probe render audio video 视频 媒体 音频 配乐',pattern:/^(?:media_|video_(?:render|probe|inspect|info|extract|thumbnail)|mcp__ffmpeg__)/i},
  {id:'premiere',label:'Premiere Pro',projects:['video-edit'],keywords:'premiere editing timeline Adobe 剪辑 视频编辑 时间线',pattern:/^mcp__premiere__/i},
  {id:'jianying',label:'剪映 / Jianying',projects:['video-edit'],keywords:'jianying 剪映 视频编辑 剪辑 草稿',pattern:/^mcp__jianying__/i},
  {id:'other-editors',label:'Other editing tools · Resolve / timeline',projects:['video-edit'],keywords:'davinci resolve editing timeline trimming 视频编辑 剪辑',pattern:/^(?:video_(?:edit|trim|cut|split|join|concat|transition|caption|subtitle|export)|mcp__(?:davinci|resolve)__)/i},
  {id:'onshape',label:'Onshape / FeatureScript',projects:['cad'],keywords:'onshape featurescript CAD mechanical 建模 机械 参数化',pattern:/^(?:onshape_|mcp__(?:onshape|onshape_fs|onshape_featurescript|featurescript)__)/i},
  {id:'blender',label:'Blender',projects:['cad'],keywords:'blender CAD modeling render 建模 三维 渲染',pattern:/^(?:blender_|mcp__blender__)/i},
  {id:'other-cad',label:'Other CAD kernels / applications',projects:['cad'],keywords:'cad freecad cadquery build123d fusion solidworks openscad CAD 建模 制图',pattern:/^(?:(?:cad|freecad|cadquery|build123d|openscad|fusion360|solidworks)_|mcp__(?:cad|freecad|cadquery|build123d|fusion|fusion360|openscad|solidworks)__)/i},
  {id:'canva',label:'Canva creative MCP',projects:['office','image-docs'],keywords:'canva presentation slides images design PPT 幻灯片 生图 设计',pattern:/^mcp__canva__/i},
  {id:'office',label:'PPT / Office documents',projects:['office'],keywords:'ppt powerpoint slides presentation word excel docx xlsx office 演示文稿 幻灯片 文档 表格',pattern:/^(?:(?:ppt|pptx|powerpoint|slides|presentation|office|word|docx|excel|xlsx|libreoffice|wps)_|mcp__(?:ppt|pptx|powerpoint|slides|office|word|docx|excel|xlsx|libreoffice|wps)__)/i},
  {id:'images',label:'Image generation / editing',projects:['image-docs','video'],keywords:'image photo picture generation 图片 图像 生图',pattern:/^(?:image_gen|generate_image|image_(?:edit|generate|render)|mcp__(?:image_gen|image|images|imagen|flux|comfyui|stable_diffusion)__)/i},
  {id:'svg',label:'SVG / vector graphics',projects:['image-docs'],keywords:'svg vector inkscape 矢量 向量 图形',pattern:/^(?:(?:svg|vector|inkscape)_|mcp__(?:svg|inkscape)__)/i},
  {id:'pdf',label:'PDF documents',projects:['image-docs','office'],keywords:'pdf document 文档 PDF',pattern:/^(?:pdf_|mcp__(?:pdf|pdf_tools)__)/i},
  {id:'desktop',label:'Zavora desktop support',projects:['desktop','video','video-edit','cad','office','image-docs','web-design'],support:true,keywords:'zavora desktop browser screenshot 电脑 浏览器 截图',pattern:/^mcp__zavora__/i},
];
export const familiesForTool = name => TOOL_FAMILIES.filter(family=>family.pattern.test(name));
export const specialistInProject = (name,project) => familiesForTool(name).some(family=>family.projects.includes(project));
export const familySearchText = name => familiesForTool(name).map(family=>family.keywords).join(' ').toLowerCase();
export function integrationGroups(tools,state,allowsTool) {
  const catalog=[...new Map(tools.map(tool=>[tool.name,tool])).values()];
  return TOOL_FAMILIES.filter(family=>state.project==='all' || family.projects.includes(state.project)).map(({id,label,support=false,pattern})=>{
    const members=catalog.filter(tool=>pattern.test(tool.name));
    return {id,label,support,registered:members.length,loaded:members.filter(tool=>allowsTool(tool.name,state)).length,registrationOnly:true};
  });
}
