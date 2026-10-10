export const CATEGORY_PREFIX='▥分类|';
export const CATEGORY_TYPES=['主线','支线','日常'];
export const CATEGORY_COLORS=[['jade','翡翠'],['gold','星金'],['azure','晴蓝'],['coral','珊瑚'],['violet','暮紫'],['rose','蔷薇'],['amber','琥珀'],['slate','夜灰']];
const defaults={主线:[['核心项目','gold'],['学习攻关','amber'],['关键交付','coral']],支线:[['创作','violet'],['运动','azure'],['关系','rose']],日常:[['生活整理','jade'],['通勤','slate'],['休息','azure']]};

export function sequenceCategories(quests,type,native=[]){
  if(!CATEGORY_TYPES.includes(type))return [];
  const stored=quests.filter(q=>String(q.title).startsWith(`${CATEGORY_PREFIX}${type}|`)).map(q=>{
    let meta={};try{meta=JSON.parse(q.detail||'{}');}catch{}
    return {id:q.id,name:q.title.split('|').slice(2).join('|'),color:meta.k||'jade',defaultName:meta.d,deleted:meta.x===1,type};
  });
  const builtins=defaults[type].map(([name,color])=>{
    const override=stored.filter(c=>c.defaultName===name).sort((a,b)=>b.id-a.id)[0];
    return override||{name,color,defaultName:name,type};
  });
  return [...builtins.filter(c=>!c.deleted),...stored.filter(c=>!c.defaultName&&!c.deleted),...native.filter(c=>c.parentType===type).map(c=>({...c,color:c.colorKey,type,native:true}))];
}

export function categoryMutation(category,name,color,remove=false){
  const type=category.type;
  if(!CATEGORY_TYPES.includes(type))throw new Error('主线、支线、日常三个大类不可修改');
  name=String(name).trim().replace(/\s+/g,' ');
  if(!remove&&(name.length<2||name.length>12))throw new Error('细分分类名称需为 2–12 个字');
  if(!CATEGORY_COLORS.some(([key])=>key===color))throw new Error('请选择有效颜色');
  if(category.native)return remove?{action:'deleteTimeCategory',categoryId:category.id}:{action:'saveTimeCategory',categoryId:category.id,parentType:type,categoryName:name,colorKey:color};
  if(remove&&!category.defaultName)return {action:'deleteQuest',questId:category.id};
  const detail={k:color,...(category.defaultName?{d:category.defaultName}:{}),...(remove?{x:1}:{})};
  return {action:category.id?'editQuest':'createQuest',...(category.id?{questId:category.id}:{}),type,title:`${CATEGORY_PREFIX}${type}|${name}`,detail:JSON.stringify(detail)};
}

const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;};
export function createCategoryManager({getCategories,mutate,onSaved,notify}){
  const panel=el('section','sequence-category-manager');
  panel.append(el('h3','','时间分类'),el('p','','细分分类可改名、换色或删除；三个大类固定。历史记录保留原分类。'));
  let editing=null,chosen='gold',busy=false;
  const creator=el('div','sequence-category-form'),typeSelect=el('select');typeSelect.setAttribute('aria-label','所属大类');
  CATEGORY_TYPES.forEach(type=>{const option=el('option','',type);typeSelect.append(option);});
  const name=el('input');name.placeholder='新增细分分类';name.maxLength=12;name.setAttribute('aria-label','细分分类名称');
  const palette=el('div','sequence-category-palette');
  const setColor=key=>{chosen=key;palette.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.color===key));};
  CATEGORY_COLORS.forEach(([key,label])=>{const button=el('button',`color-${key}`);button.type='button';button.dataset.color=key;button.setAttribute('aria-label',label);button.title=label;button.onclick=()=>setColor(key);palette.append(button);});setColor(chosen);
  const save=el('button','save','保存分类'),cancel=el('button','','取消编辑');cancel.hidden=true;
  const reset=()=>{editing=null;name.value='';name.placeholder='新增细分分类';typeSelect.disabled=false;cancel.hidden=true;save.textContent='保存分类';};cancel.onclick=reset;
  const perform=async payload=>{if(busy)return;busy=true;panel.setAttribute('aria-busy','true');panel.querySelectorAll('button').forEach(b=>b.disabled=true);try{await mutate(payload);onSaved();}catch(error){notify(error.message||'保存失败，请重试');}finally{busy=false;panel.removeAttribute('aria-busy');panel.querySelectorAll('button').forEach(b=>b.disabled=false);}};
  CATEGORY_TYPES.forEach(type=>{
    const group=el('section','sequence-category-group');group.append(el('b','',type));const list=el('div','sequence-category-chips');
    getCategories(type).forEach(category=>{
      const chip=el('span',`sequence-category-chip color-${category.color}`),edit=el('button','sequence-category-edit');edit.type='button';edit.setAttribute('aria-label',`修改分类 ${category.name}`);edit.title='修改名称和颜色';edit.append(el('i'),document.createTextNode(category.name),el('small','','✎'));
      edit.onclick=()=>{editing=category;typeSelect.value=type;typeSelect.disabled=true;name.value=category.name;setColor(category.color);save.textContent='保存修改';cancel.hidden=false;name.focus();};
      const remove=el('button','sequence-category-remove','×');remove.type='button';remove.setAttribute('aria-label',`删除分类 ${category.name}`);
      remove.onclick=()=>{if(confirm(`删除「${category.name}」分类？已有时间记录会保留，不会被删除。`))void perform(categoryMutation(category,category.name,category.color,true));};chip.append(edit,remove);list.append(chip);
    });
    if(!list.children.length)list.append(el('small','','暂无细分分类，可在下方添加。'));
    group.append(list);panel.append(group);
  });
  // getCategories can return new objects; compare stable category identity for edits.
  save.onclick=()=>{try{const type=editing?.type||typeSelect.value,value=name.value.trim().replace(/\s+/g,' ');if(getCategories(type).some(c=>c.name===value&&!(editing&&(editing.id?c.id===editing.id&&!!c.native===!!editing.native:c.defaultName===editing.defaultName))))throw new Error('该大类下已有同名分类');void perform(categoryMutation(editing||{type},value,chosen));}catch(error){notify(error.message);}};
  creator.append(typeSelect,name,palette,save,cancel);panel.append(creator);return panel;
}
