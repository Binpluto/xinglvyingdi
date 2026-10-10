"use client";
import {useEffect,useRef,useState} from 'react';
import '../vercel-proxy/starlane-ui.css';
import {dateRange,shiftCalendarDate,validDate,downloadTimeline} from '../vercel-proxy/starlane-data.mjs';

export type TimelineBlock={id:number;blockDate:string;startMinute:number;endMinute:number;title:string;type:'主线'|'支线'|'日常';categoryName:string;colorKey:string;note:string;createdAt:string;updatedAt:string};
export async function fetchTimeRange(start:string,end:string):Promise<TimelineBlock[]> {
  const response=await fetch(`/api/game?view=timeTrack&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
  const json=await response.json();if(!response.ok)throw new Error(json.error||'读取日程失败');return json.blocks;
}

export function TimeRangeExport({date,onClose}:{date:string;onClose:()=>void}) {
  const [start,setStart]=useState(date),[end,setEnd]=useState(date),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
  async function save(format:string){
    if(!validDate(start)||!validDate(end)||start>end){setStatus('请选择有效范围，结束日期不能早于开始日期');return;}
    setBusy(true);setStatus('正在读取所选范围…');
    try{const blocks=await fetchTimeRange(start,end);if(!blocks.length){setStatus('所选范围暂无时间块');return;}
      downloadTimeline(blocks.map(b=>({id:b.id,date:b.blockDate,start:b.startMinute,end:b.endMinute,title:b.title,type:b.type,category:b.categoryName,color:b.colorKey,note:b.note})),format,`${start}_${end}`);
      setStatus(`已导出 ${blocks.length} 个时间块`);
    }catch(error){setStatus(error instanceof Error?error.message:'导出失败');}finally{setBusy(false);}
  }
  return <div className="time-block-editor-backdrop"><section className="time-block-editor" role="dialog" aria-modal="true" aria-label="导出日程"><button className="editor-close" onClick={onClose} aria-label="关闭导出">×</button><h3>导出日程</h3><p>周与月以当前选中日期为基准，包含起止两天。ICS 使用当地时间。</p><div className="starlane-exports">{[['day','当天'],['week','本周'],['month','本月']].map(([unit,label])=><button key={unit} onClick={()=>{const range=dateRange(date,unit);setStart(range.start);setEnd(range.end);}}>{label}</button>)}</div><label><span>开始日期</span><input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label><span>结束日期</span><input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><p role="status">{status}</p><footer>{['csv','ics'].map(format=><button key={format} className="save" disabled={busy||!validDate(start)||!validDate(end)||start>end} onClick={()=>void save(format)}>导出 {format.toUpperCase()}</button>)}</footer></section></div>;
}

export function StarWeekView({date,step,blocks,onCreate,onTask,onEdit,onUpdate,onDay}:{date:string;step:number;blocks:TimelineBlock[];onCreate:(date:string,start:number,end:number)=>void;onTask:(id:number,date:string,minute:number)=>void;onEdit:(b:TimelineBlock)=>void;onUpdate:(b:TimelineBlock)=>void;onDay:(date:string)=>void}) {
  const range=dateRange(date,'week'),days=Array.from({length:7},(_,i)=>shiftCalendarDate(range.start,i));
  const scroll=useRef<HTMLDivElement>(null),height=1440/step*18;
  useEffect(()=>{if(scroll.current)scroll.current.scrollTop=360/step*18;},[date,step]);
  function pointerMinute(y:number,grid:HTMLElement){return Math.max(0,Math.min(1440-step,Math.round((y-grid.getBoundingClientRect().top)/18)*step));}
  function begin(event:React.PointerEvent,day:string,block?:TimelineBlock,mode='create') {
    event.stopPropagation();
    const grid=(event.target as HTMLElement).closest('.starlane-compat-grid') as HTMLElement;
    const origin=pointerMinute(event.clientY,grid),originY=event.clientY;
    let start=block?.startMinute??origin,end=block?.endMinute??Math.min(1440,origin+step);
    const preview=document.createElement('div');preview.className='starlane-compat-preview';grid.append(preview);
    const draw=()=>{preview.style.top=`${start/step*18}px`;preview.style.height=`${(end-start)/step*18}px`;preview.textContent=`${String(Math.floor(start/60)).padStart(2,'0')}:${String(start%60).padStart(2,'0')} — ${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`;};draw();
    const move=(e:PointerEvent)=>{
      const minute=pointerMinute(e.clientY,grid);
      if(mode==='move'&&block){const duration=block.endMinute-block.startMinute;start=Math.max(0,Math.min(1440-duration,block.startMinute+Math.round((e.clientY-originY)/18)*step));end=start+duration;}
      else if(mode==='resize'&&block){end=Math.max(start+step,Math.min(1440,minute+step));}
      else{start=Math.min(origin,minute);end=Math.min(1440,Math.max(origin,minute)+step);}draw();
    };
    const cancel=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',cancel);preview.remove();};
    const finish=()=>{cancel();if(block)onUpdate({...block,startMinute:start,endMinute:end});else onCreate(day,start,end);};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish,{once:true});window.addEventListener('pointercancel',cancel,{once:true});
  }
  return <section className="starlane-compat-timeline-panel"><div className="starlane-compat-legend">{range.start} — {range.end} · 周一至周日（手机可左右滑动）</div><div ref={scroll} className="starlane-compat-scroll starlane-week-scroll"><div className="starlane-compat-hours" style={{height}}>{Array.from({length:25},(_,hour)=><span key={hour} style={{top:hour*60/step*18}}>{String(hour).padStart(2,'0')}:00</span>)}</div><div className="starlane-week-lanes">{days.map(day=><div key={day} className="starlane-day-column"><button className="starlane-day-heading" onClick={()=>onDay(day)}>{['周日','周一','周二','周三','周四','周五','周六'][new Date(day+'T12:00:00Z').getUTCDay()]} {day.slice(5)}</button><div className="starlane-compat-grid" style={{height,'--slot-height':'18px'} as React.CSSProperties} onPointerDown={e=>{if(!(e.target as HTMLElement).closest('.starlane-compat-block'))begin(e,day);}} onDragOver={e=>{if(e.dataTransfer.types.includes('application/x-starcamp-task'))e.preventDefault();}} onDrop={e=>{e.preventDefault();onTask(Number(e.dataTransfer.getData('application/x-starcamp-task')),day,pointerMinute(e.clientY,e.currentTarget));}}>{blocks.filter(b=>b.blockDate===day).map(b=><article key={b.id} className={`starlane-compat-block color-${b.colorKey}`} style={{top:b.startMinute/step*18,height:Math.max(16,(b.endMinute-b.startMinute)/step*18-2)}}><u className="drag" onPointerDown={e=>begin(e,day,b,'move')}>⋮⋮</u><button onPointerDown={e=>e.stopPropagation()} onClick={()=>onEdit(b)}><b>{b.title}</b><small>{b.type}</small></button><i onPointerDown={e=>begin(e,day,b,'resize')}/></article>)}</div></div>)}</div></div></section>;
}
