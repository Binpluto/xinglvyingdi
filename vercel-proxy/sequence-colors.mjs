export const taskColors={
  主线:{key:'gold',background:'#f1e2bf',text:'#947134'},
  支线:{key:'azure',background:'#dbe6f3',text:'#4d6c8d'},
  日常:{key:'jade',background:'#d7efea',text:'#377b76'},
};
export function defaultTaskColor(type){return (taskColors[type]||taskColors.日常).key;}
export function sequenceColor(type,storedType,key,explicit){
  // Older records have no flag. Retain non-default colors; the old side default was violet.
  const legacyDefaults=storedType==='支线'?['azure','violet']:[defaultTaskColor(storedType)];
  const custom=explicit===true||explicit===1||(explicit==null&&Boolean(key)&&!legacyDefaults.includes(key));
  return {color:custom?key:defaultTaskColor(type),colorCustom:custom};
}
export function taskTrayStyle(type){const value=taskColors[type]||taskColors.日常;return {'--task-background':value.background,'--task-text':value.text};}
