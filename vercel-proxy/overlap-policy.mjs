export function normalizeBlock(b){return {id:b.id,date:b.date??b.blockDate,start:b.start??b.startMinute,end:b.end??b.endMinute,title:b.title};}
export function overlappingBlocks(input,blocks){const b=normalizeBlock(input);return blocks.map(normalizeBlock).filter(other=>other.id!==b.id&&other.date===b.date&&other.start<b.end&&other.end>b.start);}
export const overlapKey=b=>`${b.id}:${b.date}:${b.start}:${b.end}`;
export function overlapConsent(input,conflicts){return !conflicts.length||(input.allowOverlap===true&&Array.isArray(input.overlapKeys)&&conflicts.every(b=>input.overlapKeys.includes(overlapKey(b))));}
export function overlapMessage(conflicts){const time=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;return `这段时间与以下任务重叠：\n${conflicts.slice(0,5).map(b=>`• ${b.title}（${time(b.start)}–${time(b.end)}）`).join('\n')}${conflicts.length>5?`\n另有 ${conflicts.length-5} 项`:''}\n\n是否允许重叠？两项记录将保留各自时长，汇总可能重复计入重叠时段。\n取消将保留原记录不变。`;}
export function overlapLayout(blocks){
  const result=new Map();let group=[],ends=[],groupEnd=-1;
  const flush=()=>{group.forEach(({block,column})=>result.set(block.id,{column,columns:ends.length}));group=[];ends=[];};
  [...blocks].sort((a,b)=>a.start-b.start||a.end-b.end).forEach(block=>{if(block.start>=groupEnd){flush();groupEnd=-1;}let column=ends.findIndex(end=>end<=block.start);if(column<0)column=ends.length;ends[column]=block.end;group.push({block,column});groupEnd=Math.max(groupEnd,block.end);});flush();return result;
}
