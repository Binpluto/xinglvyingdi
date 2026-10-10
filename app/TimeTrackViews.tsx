"use client";
import {useEffect,useRef,useState} from 'react';
import '../vercel-proxy/starlane-ui.css';
import '../vercel-proxy/starlane-flat.css';
import {createDayBoard,createWeekOverview} from '../vercel-proxy/starlane-grid.mjs';
import {dateRange,validDate,downloadAuthorizedTimeline} from '../vercel-proxy/starlane-data.mjs';

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
    try{await downloadAuthorizedTimeline(start,end,format);
      setStatus('导出文件已生成');
    }catch(error){setStatus(error instanceof Error?error.message:'导出失败');}finally{setBusy(false);}
  }
  return <div className="time-block-editor-backdrop"><section className="time-block-editor" role="dialog" aria-modal="true" aria-label="导出日程"><button className="editor-close" onClick={onClose} aria-label="关闭导出">×</button><h3>导出日程</h3><p>周与月以当前选中日期为基准，包含起止两天。ICS 使用当地时间。</p><div className="starlane-exports">{[['day','当天'],['week','本周'],['month','本月']].map(([unit,label])=><button key={unit} onClick={()=>{const range=dateRange(date,unit);setStart(range.start);setEnd(range.end);}}>{label}</button>)}</div><label><span>开始日期</span><input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label><span>结束日期</span><input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><p role="status">{status}</p><footer>{['csv','ics'].map(format=><button key={format} className="save" disabled={busy||!validDate(start)||!validDate(end)||start>end} onClick={()=>void save(format)}>导出 {format.toUpperCase()}</button>)}</footer></section></div>;
}

export function StarFlatView({date,step,blocks,mode,onCreate,onTask,onEdit,onUpdate,onDay}:{date:string;step:number;blocks:TimelineBlock[];mode:'day'|'week';onCreate:(date:string,start:number,end:number)=>void;onTask:(id:number,date:string,minute:number)=>void;onEdit:(b:TimelineBlock)=>void;onUpdate:(b:TimelineBlock)=>void;onDay:(date:string)=>void}) {
  const host=useRef<HTMLDivElement>(null);
  const callbacks=useRef({onCreate,onTask,onEdit,onUpdate,onDay});
  callbacks.current={onCreate,onTask,onEdit,onUpdate,onDay};
  useEffect(()=>{
    const target=host.current;if(!target)return;
    const normalized=blocks.map(b=>({id:b.id,date:b.blockDate,start:b.startMinute,end:b.endMinute,title:b.title,type:b.type,category:b.categoryName,color:b.colorKey,note:b.note}));
    const task=(id:number,day:string,minute:number)=>callbacks.current.onTask(id,day,minute);
    const board=mode==='week'?createWeekOverview({date,blocks:normalized,onDay:(day:string)=>callbacks.current.onDay(day),onTask:task}):createDayBoard({date,step,blocks:normalized,onCreate:(day:string,start:number,end:number)=>callbacks.current.onCreate(day,start,end),onTask:task,
      onEdit:(b:{id:number})=>{const record=blocks.find(item=>item.id===b.id);if(record)callbacks.current.onEdit(record);},
      onMove:(b:{id:number;start:number;end:number})=>{const record=blocks.find(item=>item.id===b.id);if(record)callbacks.current.onUpdate({...record,startMinute:b.start,endMinute:b.end});}
    });
    target.replaceChildren(board);
    return ()=>board.remove();
  },[date,step,blocks,mode]);
  return <div ref={host} className="flat-timeline-panel"/>;
}
