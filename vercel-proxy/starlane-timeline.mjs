import {dateRange,shiftCalendarDate} from './starlane-data.mjs';

const label=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const colors={jade:'#3f8d7a',gold:'#d09c3f',azure:'#4e86bd',coral:'#d97862',violet:'#8068b2',rose:'#bd6588',amber:'#bf7637',slate:'#607680'};
const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=text;return node;};
export function minuteAtRatio(ratio,step){return Math.max(0,Math.min(1440-step,Math.round(ratio*1440/step)*step));}
export function fittedTimelineHeight(viewport,top,mobile){const base=Math.max(336,Math.min(1000,viewport-top-(mobile?90:30)));return mobile?base:base*2;}

export function createVerticalTimeline({date,step,blocks,mode='day',onCreate,onTask,onEdit,onMove,onDay}) {
  const range=dateRange(date,mode),days=mode==='week'?Array.from({length:7},(_,i)=>shiftCalendarDate(range.start,i)):[date];
  const panel=el('section',`full-timeline-panel ${mode==='week'?'is-week':'is-day'}`);
  panel.append(el('div','full-timeline-caption',mode==='week'?`${range.start} — ${range.end} · 全周时间轴`:'全天时间轴 · 00:00–24:00'));
  const headings=el('div','full-timeline-headings');headings.style.setProperty('--days',String(days.length));
  days.forEach(day=>{const heading=el('button','',`${['周日','周一','周二','周三','周四','周五','周六'][new Date(day+'T12:00:00Z').getUTCDay()]} ${day.slice(5)}`);heading.onclick=()=>onDay(day);headings.append(heading);});panel.append(headings);
  const body=el('div','full-timeline-body');const labels=el('div','full-timeline-hours');
  for(let hour=0;hour<=24;hour++){const mark=el('span','',`${String(hour).padStart(2,'0')}:00`);mark.style.top=`${hour/24*100}%`;labels.append(mark);}body.append(labels);
  const lanes=el('div','full-timeline-lanes');lanes.style.setProperty('--days',String(days.length));
  let cancelActive=null,draggedTitle='',dropPreview=null;
  const clearDrop=()=>{dropPreview?.remove();dropPreview=null;};
  const dragStart=e=>{draggedTitle=e.target.closest?.('.starlane-task-item')?.querySelector('b')?.textContent||'任务';};
  const dragEnd=()=>{clearDrop();draggedTitle='';};
  document.addEventListener('dragstart',dragStart);document.addEventListener('dragend',dragEnd);
  const minute=(event,lane)=>{const rect=lane.getBoundingClientRect();return minuteAtRatio((event.clientY-rect.top)/rect.height,step);};
  const place=(node,start,end)=>{node.style.top=`${start/1440*100}%`;node.style.height=`${(end-start)/1440*100}%`;};
  function gesture(event,lane,day,block,operation){
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();cancelActive?.();
    const origin=minute(event,lane),originY=event.clientY;let start=block?.start??origin,end=block?.end??origin+step,moved=false;
    const preview=el('div','full-timeline-preview');const hint=el('span','full-timeline-hint');preview.append(hint);lane.append(preview);
    const paint=()=>{place(preview,start,end);hint.textContent=`${block?.title||'新增记录'} · ${label(start)}–${label(end)}`;};paint();
    const move=e=>{
      moved=moved||Math.abs(e.clientY-originY)>3;
      const target=minute(e,lane);
      if(block&&operation==='move'){const duration=block.end-block.start;start=Math.max(0,Math.min(1440-duration,block.start+target-origin));end=start+duration;}
      else if(block&&operation==='resize'){end=Math.max(start+step,Math.min(1440,target+step));}
      else{start=Math.min(origin,target);end=Math.min(1440,Math.max(origin,target)+step);}paint();
    };
    const cleanup=()=>{preview.remove();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',cleanup);cancelActive=null;};
    const finish=()=>{cleanup();if(!panel.isConnected)return;if(block){if(moved)onMove({...block,start,end});else onEdit(block);}else onCreate(day,start,end);};
    cancelActive=cleanup;window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish,{once:true});window.addEventListener('pointercancel',cleanup,{once:true});
  }
  days.forEach(day=>{
    const lane=el('div','full-timeline-lane');lane.dataset.date=day;lane.style.setProperty('--step-percent',`${step/1440*100}%`);lane.setAttribute('aria-label',`${day} 00:00–24:00 时间轴`);
    lane.onpointerdown=e=>{if(!e.target.closest('.full-time-block'))gesture(e,lane,day,null,'create');};
    lane.ondragover=e=>{if(e.dataTransfer.types.includes('application/x-starcamp-task')){e.preventDefault();e.dataTransfer.dropEffect='copy';if(dropPreview?.parentElement!==lane){clearDrop();dropPreview=el('div','full-timeline-preview');dropPreview.append(el('span','full-timeline-hint'));lane.append(dropPreview);}const start=minute(e,lane),end=Math.min(1440,start+Math.max(step,30));place(dropPreview,start,end);dropPreview.firstChild.textContent=`${draggedTitle||'任务'} · ${label(start)}–${label(end)}`;}};
    lane.ondragleave=e=>{if(!lane.contains(e.relatedTarget))clearDrop();};
    lane.ondrop=e=>{e.preventDefault();clearDrop();if(e.dataTransfer.types.includes('application/x-starcamp-task'))onTask(Number(e.dataTransfer.getData('application/x-starcamp-task')),day,minute(e,lane));};
    blocks.filter(b=>b.date===day).forEach(block=>{
      const row=el('article','full-time-block');row.style.setProperty('--block-color',colors[block.color]||colors.jade);place(row,block.start,block.end);row.title=`${label(block.start)}–${label(block.end)} ${block.title}`;
      row.onpointerdown=e=>gesture(e,lane,day,block,'move');
      const button=el('button','full-time-copy');button.setAttribute('aria-label',`编辑 ${row.title}`);button.append(el('b','',block.title),el('small','',`${label(block.start)}–${label(block.end)} · ${block.type}`));
      button.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onEdit(block);}};
      const resize=el('i','full-time-resize');resize.setAttribute('aria-label','拖动调整结束时间');resize.onpointerdown=e=>gesture(e,lane,day,block,'resize');
      row.append(button,resize);lane.append(row);
    });lanes.append(lane);
  });body.append(lanes);panel.append(body);
  panel.append(el('p','full-timeline-note',`刻度 ${step} 分钟 · 拖选空白新增 / 拖动色块移动 / 点击编辑短时段`));
  let disposed=false;
  const fit=()=>{if(disposed||!panel.isConnected)return;const top=body.getBoundingClientRect().top+window.scrollY;const mobile=window.innerWidth<=800;
    const height=fittedTimelineHeight(window.visualViewport?.height||window.innerHeight,top,mobile);
    if(body.style.height!==`${height}px`)body.style.height=`${height}px`;
    panel.querySelectorAll('.full-time-block').forEach(row=>row.classList.toggle('short-block',row.getBoundingClientRect().height<15));
  };
  const observer=new ResizeObserver(fit);observer.observe(panel);window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);requestAnimationFrame(fit);
  panel.dispose=()=>{disposed=true;cancelActive?.();clearDrop();document.removeEventListener('dragstart',dragStart);document.removeEventListener('dragend',dragEnd);observer.disconnect();window.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('resize',fit);};
  return panel;
}
