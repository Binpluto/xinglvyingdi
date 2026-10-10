import {dateRange,shiftCalendarDate} from './starlane-data.mjs';

const label=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const colors={jade:'#3f8d7a',gold:'#d09c3f',azure:'#4e86bd',coral:'#d97862',violet:'#8068b2',rose:'#bd6588',amber:'#bf7637',slate:'#607680'};
function node(tag,cls,text){const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;}
export function dayCells(blocks,step){
  return Array.from({length:1440/step},(_,i)=>{const start=i*step,end=start+step;return {start,end,blocks:blocks.filter(b=>b.start<end&&b.end>start)};});
}

export function createDayBoard({date,step,blocks,onCreate,onEdit,onMove,onTask}) {
  const panel=node('section','flat-day-board');panel.dataset.date=date;
  const caption=node('div','flat-board-caption');caption.append(node('b','','全天 00:00–24:00'),node('span','',`每格 ${step} 分钟 · 空白拖选记录 / 色块拖动换时间`));panel.append(caption);
  const grid=node('div','flat-hours');grid.setAttribute('aria-label',`${date} 全天时间网格`);
  const cells=dayCells(blocks,step),cellNodes=[];
  for(let hour=0;hour<24;hour++){
    const card=node('section','flat-hour'),head=node('header','');
    head.append(node('b','',`${String(hour).padStart(2,'0')}:00`));
    const hourBlocks=blocks.filter(b=>b.start<(hour+1)*60&&b.end>hour*60);
    head.append(node('small','',hourBlocks.length?hourBlocks.map(b=>b.title).join(' · '):''));card.append(head);
    const row=node('div','flat-slots');row.style.gridTemplateColumns=`repeat(${60/step},minmax(0,1fr))`;
    for(const slot of cells.slice(hour*60/step,(hour+1)*60/step)){
      const cell=node('button','flat-slot');cell.type='button';cell.dataset.minute=String(slot.start);
      const names=slot.blocks.map(b=>b.title).join('、');cell.title=`${label(slot.start)}–${label(slot.end)} ${names||'未安排'}`;cell.setAttribute('aria-label',cell.title);
      cell.textContent=`${String(slot.start%60).padStart(2,'0')}`;
      if(slot.blocks.length){cell.classList.add('occupied');cell.style.setProperty('--slot-color',colors[slot.blocks[0].color]||colors.jade);}
      cell.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();slot.blocks.length?onEdit(slot.blocks[0]):onCreate(date,slot.start,slot.end);}});
      cell.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('application/x-starcamp-task')){e.preventDefault();e.dataTransfer.dropEffect='copy';cell.classList.add('drop-target');}});
      cell.addEventListener('dragleave',()=>cell.classList.remove('drop-target'));
      cell.addEventListener('drop',e=>{e.preventDefault();cell.classList.remove('drop-target');onTask(Number(e.dataTransfer.getData('application/x-starcamp-task')),date,slot.start);});
      cell.addEventListener('pointerdown',e=>startGesture(e,slot));row.append(cell);cellNodes.push(cell);
    }
    card.append(row);grid.append(card);
  }
  const status=node('p','flat-board-status','点格子查看或编辑；跨小时拖选会连续记录。');status.setAttribute('role','status');
  let cancelGesture=null;
  function startGesture(event,slot){
    if(event.button!==0)return;
    cancelGesture?.();event.preventDefault();
    let target=slot.start,moved=false;const block=slot.blocks[0];
    const paint=()=>{let from=Math.min(slot.start,target),to=Math.max(slot.start,target)+step;
      if(block){from=Math.max(0,Math.min(1440-(block.end-block.start),block.start+target-slot.start));to=from+block.end-block.start;}
      cellNodes.forEach(c=>c.classList.toggle('selecting',Number(c.dataset.minute)<to&&Number(c.dataset.minute)+step>from));status.textContent=`${label(from)}–${label(to)} · ${to-from} 分钟`;
    };
    const move=e=>{const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('.flat-slot');if(!hit||!grid.contains(hit))return;target=Number(hit.dataset.minute);moved=target!==slot.start;paint();};
    const cleanup=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',cleanup);cellNodes.forEach(c=>c.classList.remove('selecting'));cancelGesture=null;};
    const finish=()=>{cleanup();if(!panel.isConnected)return;
      if(block){if(moved){const start=Math.max(0,Math.min(1440-(block.end-block.start),block.start+target-slot.start));onMove({...block,start,end:start+block.end-block.start});}else onEdit(block);}
      else onCreate(date,Math.min(slot.start,target),Math.min(1440,Math.max(slot.start,target)+step));
    };
    cancelGesture=cleanup;paint();window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish,{once:true});window.addEventListener('pointercancel',cleanup,{once:true});
  }
  panel.append(grid,status);
  const details=node('details','flat-record-list');details.append(node('summary','',`当日记录 · ${blocks.length} 项（点开查看完整名称）`));
  [...blocks].sort((a,b)=>a.start-b.start).forEach(block=>{const button=node('button','',`${label(block.start)}–${label(block.end)}　${block.title} · ${block.type}`);button.onclick=()=>onEdit(block);details.append(button);});panel.append(details);
  return panel;
}

export function createWeekOverview({date,blocks,onDay,onTask}) {
  const range=dateRange(date,'week'),panel=node('section','flat-week-board');
  panel.append(node('div','flat-board-caption',`${range.start} — ${range.end} · 全天概览，点日期查看分钟刻度`));
  const grid=node('div','flat-week-grid');
  for(let day=0;day<7;day++){
    const key=shiftCalendarDate(range.start,day),list=blocks.filter(b=>b.date===key),card=node('section','flat-week-day');
    const heading=node('button','flat-week-heading',`${['周一','周二','周三','周四','周五','周六','周日'][day]} ${key.slice(5)}`);heading.onclick=()=>onDay(key);card.append(heading);
    const hours=node('div','flat-week-hours');
    for(let h=0;h<24;h++){
      const matches=list.filter(b=>b.start<(h+1)*60&&b.end>h*60),cell=node('button','flat-week-hour',String(h).padStart(2,'0'));
      cell.title=`${key} ${label(h*60)}–${label((h+1)*60)} ${matches.map(b=>b.title).join('、')||'未安排'}`;
      if(matches.length){cell.classList.add('occupied');cell.style.setProperty('--slot-color',colors[matches[0].color]||colors.jade);}
      cell.onclick=()=>onDay(key);
      cell.ondragover=e=>{if(e.dataTransfer.types.includes('application/x-starcamp-task'))e.preventDefault();};
      cell.ondrop=e=>{e.preventDefault();onTask(Number(e.dataTransfer.getData('application/x-starcamp-task')),key,h*60);};hours.append(cell);
    }
    card.append(hours,node('small','flat-week-total',`${list.reduce((n,b)=>n+b.end-b.start,0)} 分钟`));grid.append(card);
  }
  panel.append(grid);return panel;
}
