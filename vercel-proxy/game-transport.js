// Per-tab, memory-only read sharing. Never cache across accounts or cache write responses as HTTP responses.
(function(root){
  function createTransport(fetcher,{now=()=>Date.now(),ttl=8000,onData=()=>{},onWrite=()=>()=>{},onReset=()=>{},onAuth=()=>{}}={}){
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
      if(auth){authEpoch++;reset();onAuth();try{return await fetcher(input,options);}finally{authEpoch++;reset();onAuth();}}
      if((game||sequence)&&method!=='GET'&&method!=='HEAD'){
        const previous=snapshot?.data;reset();const generation=epoch;pendingWrites++;let body={};try{body=JSON.parse(options.body||'{}');}catch{}
        const finish=onWrite(body,previous);let ok=false;
        try{const response=await fetcher(input,options);ok=response.ok;if(generation===epoch){reset();const completedEpoch=epoch;if(ok){try{const json=await response.clone().json();if(completedEpoch===epoch)publish(json);}catch{}}}return response;}
        catch(error){if(['deleteQuest','batchDeleteQuests','editQuest'].includes(body.action))return new Response(JSON.stringify({error:`网络中断，${body.action==='editQuest'?'修改':'删除'}结果未确认，请刷新后确认`}),{status:503,headers:{'Content-Type':'application/json'}});throw error;}
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
        if(response.status===401){reset();onAuth();return response;}
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
  let clickedEditForm=null;
  document.addEventListener('click',event=>{clickedEditForm=event.target.closest?.('.quest-edit-form')||null;},true);
  const activeEditForm=()=>document.activeElement?.closest('.quest-edit-form')||(clickedEditForm?.isConnected?clickedEditForm:null);
  function pendingEdit(payload,previous){
    if(payload.action!=='editQuest'||!['主线','支线','日常'].includes(payload.type)||/^(▥时轨\||▥分类\|)/.test(payload.title||''))return ()=>{};
    const token=crypto.randomUUID();
    root.dispatchEvent(new CustomEvent('starcamp:quest-edit-pending',{detail:{payload,previous,token}}));
    const form=activeEditForm(),row=form?.closest('.quest');
    let preview=null,oldDisplay='',oldPriority='';
    if(form&&row){
      oldDisplay=form.style.getPropertyValue('display');oldPriority=form.style.getPropertyPriority('display');form.style.setProperty('display','none','important');
      preview=document.createElement('div');preview.className='quest-text starcamp-edit-preview';preview.setAttribute('role','status');
      const badge=document.createElement('span');badge.className=`quest-type type-${payload.type}`;badge.textContent=payload.type;
      const title=document.createElement('h4');title.textContent=payload.title;
      const detail=document.createElement('p');detail.textContent=payload.detail||'';
      const status=document.createElement('small');status.textContent='正在同步修改…';preview.append(badge,title,detail,status);row.append(preview);
    }
    const notice=document.createElement('div');notice.className='starcamp-pending-operation';notice.setAttribute('role','status');notice.textContent=`已切换为${payload.type}，正在同步…`;document.body.append(notice);
    return ok=>{
      preview?.remove();if(form){if(oldDisplay)form.style.setProperty('display',oldDisplay,oldPriority);else form.style.removeProperty('display');}
      root.dispatchEvent(new CustomEvent('starcamp:quest-edit-settled',{detail:{questId:payload.questId,token,ok}}));
      notice.textContent=ok?'任务修改已同步':'修改未确认，已恢复原记录；编辑内容保留，可重试';setTimeout(()=>notice.remove(),ok?1800:5000);
    };
  }
  function pendingDeletion(payload){
    if(!['deleteQuest','batchDeleteQuests'].includes(payload.action))return ()=>{};
    const rows=payload.action==='batchDeleteQuests'?[...document.querySelectorAll('.quest.selected')]:[activeEditForm()?.closest('.quest')].filter(Boolean);
    if(!rows.length)return ()=>{};
    const before=rows.map(row=>({row,display:row.style.getPropertyValue('display'),priority:row.style.getPropertyPriority('display')}));rows.forEach(row=>row.style.setProperty('display','none','important'));
    const notice=document.createElement('div');notice.className='starcamp-pending-operation';notice.setAttribute('role','status');notice.textContent=`正在同步删除 ${rows.length} 项任务…`;
    document.body.append(notice);
    return ok=>{before.forEach(({row,display,priority})=>{if(display)row.style.setProperty('display',display,priority);else row.style.removeProperty('display');});notice.textContent=ok?'删除已同步':'删除未确认，任务已恢复显示，请刷新后重试';setTimeout(()=>notice.remove(),ok?1800:5000);};
  }
  const transport=createTransport(root.fetch.bind(root),{onWrite:(payload,previous)=>payload.action==='editQuest'?pendingEdit(payload,previous):pendingDeletion(payload),onAuth:()=>root.dispatchEvent(new CustomEvent('starcamp:session-reset')),onReset:()=>root.dispatchEvent(new CustomEvent('starcamp:data-invalidated')),onData:data=>root.dispatchEvent(new CustomEvent('starcamp:game-data',{detail:data}))});
  root.starcampTransport=transport;root.fetch=transport.fetch;
})(globalThis);
