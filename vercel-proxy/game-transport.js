// Per-tab, memory-only read sharing. Never cache across accounts or cache write responses as HTTP responses.
(function(root){
  function createTransport(fetcher,{now=()=>Date.now(),ttl=8000,onData=()=>{},onWrite=()=>()=>{},onReset=()=>{}}={}){
    let epoch=0,authEpoch=0,pendingWrites=0,snapshot=null;
    const writeWaiters=new Set();
    const writesSettled=()=>pendingWrites?new Promise(resolve=>writeWaiters.add(resolve)):Promise.resolve();
    const reads=new Map(),cache=new Map();
    const reset=()=>{epoch++;reads.clear();cache.clear();snapshot=null;onReset();};
    const publish=(json)=>{if(json?.user&&Array.isArray(json.quests)){snapshot={data:json,at:now()};onData(json);}};
    const request=async(input,options={})=>{
      const raw=typeof input==='string'?input:input?.url;
      const url=new URL(raw||'/',root.location?.origin||'https://starcamp.local');
      if(url.origin!==(root.location?.origin||'https://starcamp.local'))return fetcher(input,options);
      const method=String(options.method||input?.method||'GET').toUpperCase();
      const game=url.pathname==='/api/game',sequence=url.pathname==='/api/sequence-record',auth=url.pathname==='/api/auth';
      if(auth){authEpoch++;reset();try{return await fetcher(input,options);}finally{authEpoch++;reset();}}
      if((game||sequence)&&method!=='GET'&&method!=='HEAD'){
        reset();const generation=epoch;pendingWrites++;let body={};try{body=JSON.parse(options.body||'{}');}catch{}
        const finish=onWrite(body);let ok=false;
        try{const response=await fetcher(input,options);ok=response.ok;if(generation===epoch){reset();const completedEpoch=epoch;if(ok){try{const json=await response.clone().json();if(completedEpoch===epoch)publish(json);}catch{}}}return response;}
        catch(error){if(['deleteQuest','batchDeleteQuests'].includes(body.action))return new Response(JSON.stringify({error:'网络中断，删除结果未确认，请刷新后确认'}),{status:503,headers:{'Content-Type':'application/json'}});throw error;}
        finally{pendingWrites--;if(!pendingWrites){writeWaiters.forEach(resolve=>resolve());writeWaiters.clear();}finish(ok);}
      }
      // Requests with custom headers, cancellation or non-dashboard queries keep their original semantics.
      const plain=game&&method==='GET'&&typeof input==='string'&&!options.headers&&!options.signal&&[...url.searchParams.keys()].every(k=>k==='clientDate');
      if(!plain)return fetcher(input,options);
      const accountGeneration=authEpoch;
      if(pendingWrites){await writesSettled();if(accountGeneration!==authEpoch)throw new Error('账号状态已改变，请刷新');return request(input,options);}
      const key=url.href+'|'+(options.credentials||'same-origin');
      const share=options.cache!=='no-store';
      const cached=cache.get(key);if(share&&!pendingWrites&&cached&&now()-cached.at<ttl)return cached.response.clone();
      if(share&&!pendingWrites&&reads.has(key))return (await reads.get(key)).clone();
      const generation=epoch;
      const work=(async()=>{
        const response=await fetcher(input,options);
        if(accountGeneration!==authEpoch)throw new Error('账号状态已改变，请刷新');
        if(response.status===401){reset();return response;}
        if(generation!==epoch){await writesSettled();if(accountGeneration!==authEpoch)throw new Error('账号状态已改变，请刷新');return request(input,{...options,cache:'no-store'});}
        if(response.ok&&generation===epoch&&!pendingWrites){
          try{const json=await response.clone().json();if(generation===epoch&&!pendingWrites&&json?.user&&Array.isArray(json.quests)){cache.set(key,{at:now(),response:response.clone()});publish(json);}}catch{}
        }
        return response;
      })();
      if(share&&!pendingWrites)reads.set(key,work);
      try{return (await work).clone();}finally{if(reads.get(key)===work)reads.delete(key);}
    };
    return {fetch:request,reset,peek:(maxAge=ttl)=>snapshot&&now()-snapshot.at<=maxAge?snapshot.data:null};
  }
  root.createStarcampTransport=createTransport;
  if(!root.document||root.starcampTransport)return;
  function pendingDeletion(payload){
    if(!['deleteQuest','batchDeleteQuests'].includes(payload.action))return ()=>{};
    const rows=payload.action==='batchDeleteQuests'?[...document.querySelectorAll('.quest.selected')]:[document.activeElement?.closest('.quest-edit-form')?.closest('.quest')].filter(Boolean);
    if(!rows.length)return ()=>{};
    const before=rows.map(row=>({row,display:row.style.getPropertyValue('display'),priority:row.style.getPropertyPriority('display')}));rows.forEach(row=>row.style.setProperty('display','none','important'));
    const notice=document.createElement('div');notice.className='starcamp-pending-operation';notice.setAttribute('role','status');notice.textContent=`正在同步删除 ${rows.length} 项任务…`;
    document.body.append(notice);
    return ok=>{before.forEach(({row,display,priority})=>{if(display)row.style.setProperty('display',display,priority);else row.style.removeProperty('display');});notice.textContent=ok?'删除已同步':'删除未确认，任务已恢复显示，请刷新后重试';setTimeout(()=>notice.remove(),ok?1800:5000);};
  }
  const transport=createTransport(root.fetch.bind(root),{onWrite:pendingDeletion,onReset:()=>root.dispatchEvent(new CustomEvent('starcamp:data-invalidated')),onData:data=>root.dispatchEvent(new CustomEvent('starcamp:game-data',{detail:data}))});
  root.starcampTransport=transport;root.fetch=transport.fetch;
})(globalThis);
