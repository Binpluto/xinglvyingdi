import {dateRange,shiftCalendarDate} from './starlane-data.mjs';
import {overlapLayout} from './overlap-policy.mjs?v=17';
import {installTaskTouchDrag} from './sequence-touch-drag.mjs?v=21';

const label=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const colors={jade:'#3f8d7a',gold:'#d09c3f',azure:'#4e86bd',coral:'#d97862',violet:'#8068b2',rose:'#bd6588',amber:'#bf7637',slate:'#607680'};
const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=text;return node;};
export function minuteAtRatio(ratio,step,from=0,span=1440){return from+Math.max(0,Math.min(span-step,Math.round(ratio*span/step)*step));}
export function clippedInterval(start,end,from,to){const a=Math.max(start,from),b=Math.min(end,to);return b>a?{top:(a-from)/(to-from)*100,height:(b-a)/(to-from)*100}:null;}
export function fittedTimelineHeight(viewport,top,mobile){const base=Math.max(336,Math.min(1000,viewport-top-(mobile?90:30)));return mobile?base:base*2;}

export function createVerticalTimeline({date,step,blocks,mode='day',onCreate,onTask,onEdit,onMove,onDay}) {
  const week=mode==='week',range=dateRange(date,mode),days=week?Array.from({length:7},(_,i)=>shiftCalendarDate(range.start,i)):[date,date];
  const columns=days.map((day,i)=>({day,from:week?0:i*720,to:week?1440:(i+1)*720}));
  const panel=el('section',`full-timeline-panel ${mode==='week'?'is-week':'is-day is-split-day'}`);
  panel.append(el('div','full-timeline-caption',mode==='week'?`${range.start} — ${range.end} · 全周时间轴`:'全天时间轴 · 双列 12 小时'));
  const headings=el('div','full-timeline-headings');headings.style.setProperty('--days',String(days.length));
  columns.forEach(({day,from,to})=>{const heading=el('button','',week?`${['周日','周一','周二','周三','周四','周五','周六'][new Date(day+'T12:00:00Z').getUTCDay()]} ${day.slice(5)}`:`${from===0?'上半日':'下半日'} · ${label(from)}–${label(to)}`);heading.onclick=()=>onDay(day);headings.append(heading);});panel.append(headings);
  const body=el('div','full-timeline-body');
  function hourLabels(from,to){const labels=el('div','full-timeline-hours');for(let m=from;m<=to;m+=60){const mark=el('span','',label(m));mark.style.top=`${(m-from)/(to-from)*100}%`;labels.append(mark);}return labels;}
  if(week)body.append(hourLabels(0,1440));
  const laneElements=[],lanes=el('div',week?'full-timeline-lanes':'full-timeline-columns');lanes.style.setProperty('--days',String(days.length));
  let cancelActive=null,draggedTitle='',dropPreview=null;
  const clearDrop=()=>{dropPreview?.remove();dropPreview=null;};
  const dragStart=e=>{draggedTitle=e.target.closest?.('.starlane-task-item')?.querySelector('b')?.textContent||'任务';};
  const dragEnd=()=>{clearDrop();draggedTitle='';};
  document.addEventListener('dragstart',dragStart);document.addEventListener('dragend',dragEnd);
  const minute=(event,lane)=>{const rect=lane.getBoundingClientRect();return minuteAtRatio((event.clientY-rect.top)/rect.height,step,Number(lane.dataset.from),Number(lane.dataset.to)-Number(lane.dataset.from));};
  const place=(node,start,end,lane)=>{const clip=clippedInterval(start,end,Number(lane.dataset.from),Number(lane.dataset.to));node.hidden=!clip;if(clip){node.style.top=`${clip.top}%`;node.style.height=`${clip.height}%`;}};
  const previewTask=(lane,event,title)=>{if(dropPreview?.parentElement!==lane){clearDrop();dropPreview=el('div','full-timeline-preview');dropPreview.append(el('span','full-timeline-hint'));lane.append(dropPreview);}const start=minute(event,lane),end=Math.min(1440,start+Math.max(step,30));place(dropPreview,start,end,lane);dropPreview.firstChild.textContent=`${title||'任务'} · ${label(start)}–${label(end)}`;};
  function gesture(event,lane,day,block,operation){
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();cancelActive?.();
    const origin=minute(event,lane),originY=event.clientY,originX=event.clientX;let start=block?.start??origin,end=block?.end??origin+step,moved=false;
    const previews=laneElements.filter(item=>item.dataset.date===day).map(item=>{const node=el('div','full-timeline-preview'),hint=el('span','full-timeline-hint');node.append(hint);item.append(node);return {node,hint,lane:item};});
    const paint=()=>previews.forEach(p=>{place(p.node,start,end,p.lane);p.hint.textContent=`${block?.title||'新增记录'} · ${label(start)}–${label(end)}`;});paint();
    const move=e=>{
      moved=moved||Math.abs(e.clientY-originY)>3||Math.abs(e.clientX-originX)>3;
      const under=document.elementFromPoint(e.clientX,e.clientY)?.closest('.full-timeline-lane');
      const target=minute(e,!week&&under&&laneElements.includes(under)?under:lane);
      if(block&&operation==='move'){const duration=block.end-block.start;start=Math.max(0,Math.min(1440-duration,block.start+target-origin));end=start+duration;}
      else if(block&&operation==='resize'){end=Math.max(start+step,Math.min(1440,target+step));}
      else{start=Math.min(origin,target);end=Math.min(1440,Math.max(origin,target)+step);}paint();
    };
    const cleanup=()=>{previews.forEach(p=>p.node.remove());window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',cleanup);cancelActive=null;};
    const finish=()=>{cleanup();if(!panel.isConnected)return;if(block){if(moved)onMove({...block,start,end});else onEdit(block);}else onCreate(day,start,end);};
    cancelActive=cleanup;window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish,{once:true});window.addEventListener('pointercancel',cleanup,{once:true});
  }
  columns.forEach(({day,from,to})=>{
    const layout=overlapLayout(blocks.filter(b=>b.date===day));
    const lane=el('div','full-timeline-lane');Object.assign(lane.dataset,{date:day,from:String(from),to:String(to)});laneElements.push(lane);lane.style.setProperty('--step-percent',`${step/(to-from)*100}%`);lane.style.setProperty('--hour-percent',`${60/(to-from)*100}%`);lane.setAttribute('aria-label',`${day} ${label(from)}–${label(to)} 时间轴`);
    lane.onpointerdown=e=>{if(!e.target.closest('.full-time-block'))gesture(e,lane,day,null,'create');};
    lane.ondragover=e=>{if(e.dataTransfer.types.includes('application/x-starcamp-task')){e.preventDefault();e.dataTransfer.dropEffect='copy';previewTask(lane,e,draggedTitle);}};
    lane.ondragleave=e=>{if(!lane.contains(e.relatedTarget))clearDrop();};
    lane.ondrop=e=>{e.preventDefault();clearDrop();if(e.dataTransfer.types.includes('application/x-starcamp-task'))onTask(Number(e.dataTransfer.getData('application/x-starcamp-task')),day,minute(e,lane));};
    blocks.filter(b=>b.date===day&&clippedInterval(b.start,b.end,from,to)).forEach(block=>{
      const row=el('article','full-time-block');row.style.setProperty('--block-color',colors[block.color]||colors.jade);row.dataset.blockId=String(block.id);place(row,block.start,block.end,lane);if(block.start<from)row.classList.add('continues-before');if(block.end>to)row.classList.add('continues-after');row.title=`${label(block.start)}–${label(block.end)} ${block.title}`;
      const position=layout.get(block.id);if(position?.columns>1){row.classList.add('overlapping-block');row.style.left=`calc(5px + (100% - 10px) * ${position.column} / ${position.columns})`;row.style.width=`calc((100% - 10px) / ${position.columns} - 2px)`;row.style.right='auto';}
      row.onpointerdown=e=>gesture(e,lane,day,block,'move');
      const button=el('button','full-time-copy');button.setAttribute('aria-label',`编辑 ${row.title}`);button.append(el('b','',`${block.start<from?'续 · ':''}${block.title}`),el('small','',`${label(block.start)}–${label(block.end)} · ${block.type}`));
      button.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onEdit(block);}};
      const resize=el('i','full-time-resize');resize.setAttribute('aria-label','拖动调整结束时间');resize.onpointerdown=e=>gesture(e,lane,day,block,'resize');
      row.append(button);if(block.end<=to)row.append(resize);lane.append(row);
    });if(week)lanes.append(lane);else{const column=el('div','full-timeline-column'),track=el('div','full-timeline-half-track');column.append(hourLabels(from,to));track.append(lane);column.append(track);lanes.append(column);}
  });body.append(lanes);panel.append(body);
  const disposeTouch=installTaskTouchDrag({panel,lanes:laneElements,onPreview:previewTask,onClear:clearDrop,onDrop:(id,lane,event)=>onTask(id,lane.dataset.date,minute(event,lane))});
  panel.append(el('p','full-timeline-note',`刻度 ${step} 分钟 · 拖选空白新增 / 拖动色块移动 / 点击编辑${week?'':' · 跨中午记录分列显示，仍为一条记录'}`));
  let disposed=false;
  const fit=()=>{if(disposed||!panel.isConnected)return;const top=body.getBoundingClientRect().top+window.scrollY;const mobile=window.innerWidth<=800;
    const full=fittedTimelineHeight(window.visualViewport?.height||window.innerHeight,top,mobile),height=!week&&!mobile?full/2:full;
    if(body.style.height!==`${height}px`)body.style.height=`${height}px`;
    panel.querySelectorAll('.full-time-block').forEach(row=>{const h=row.getBoundingClientRect().height;row.classList.toggle('short-block',h<15);row.classList.toggle('compact-block',h<34);});
  };
  const observer=new ResizeObserver(fit);observer.observe(panel);window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);requestAnimationFrame(fit);
  panel.dispose=()=>{disposed=true;cancelActive?.();disposeTouch();clearDrop();document.removeEventListener('dragstart',dragStart);document.removeEventListener('dragend',dragEnd);observer.disconnect();window.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('resize',fit);};
  return panel;
}
