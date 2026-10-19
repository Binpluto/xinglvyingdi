(function(){let latest=null,busy=false,panel=null;
 const previousFetch=window.fetch.bind(window);window.fetch=(input,options={})=>{if(typeof input==='string'&&latest?.calendarPilot?.enabled&&latest.user?.email==='pluto.hanna@gmail.com'){const u=new URL(input,location.origin);if(u.origin===location.origin&&['/api/game','/api/sequence-record'].includes(u.pathname)&&String(options.method||'GET').toUpperCase()==='POST'){const headers=new Headers(options.headers);headers.set('x-starcamp-calendar-pilot','1');options={...options,headers};}}return previousFetch(input,options);};
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 async function api(op,extra={}){const r=await fetch('/api/calendar-pilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,clientDate:new Intl.DateTimeFormat('en-CA').format(new Date()),...extra})});const d=await r.json();if(!r.ok)throw new Error(d.error||'日历操作未完成');return d;}
 function mount(){
  if(!latest?.calendarPilot?.enabled||latest.user?.email!=='pluto.hanna@gmail.com')return;
  const host=document.querySelector('.quest-card.enriched-quests');if(!host||host.querySelector('.owner-calendar-pilot'))return;
  const bar=el('section');bar.className='owner-calendar-pilot';bar.style.cssText='padding:14px 18px;border:1px solid #b8d5c5;border-radius:14px;margin:12px 0;background:#eff7ee;color:#315c52;display:flex;gap:14px;align-items:center;flex-wrap:wrap';
  const label=el('span',latest.calendarPilot.unavailable?'多日历试运行暂不可用，已有完成历史保留':'多日历试运行 · 仅你的账号可见');
  const button=el('button','管理并同步多日历');button.onclick=open;button.style.cssText='padding:8px 14px;border:0;border-radius:8px;background:#315c52;color:white';bar.append(label,button);host.prepend(bar);
 }
 async function open(){
  if(panel)return;const backdrop=el('div');backdrop.style.cssText='position:fixed;inset:0;background:#1238;z-index:20000;display:grid;place-items:center;padding:16px';panel=backdrop;
  const card=el('section');card.style.cssText='width:min(680px,100%);max-height:90vh;overflow:auto;background:#fbfcf7;border-radius:20px;padding:24px;color:#28554f';backdrop.append(card);document.body.append(backdrop);
  const heading=el('h2','日历港湾 · 账号限定试运行'),note=el('p','Google 日历只读。同步后的事件会关联到今日任务和时序；完成时沿用原任务积分，不自动完成任务。'),status=el('p','正在读取日历…'),close=el('button','关闭');close.onclick=()=>{if(!busy){backdrop.remove();panel=null;}};card.append(close,heading,note,status);
  try{const list=await api('calendars'),chosen=new Set(list.saved.filter(c=>c.selected).map(c=>c.google_calendar_id));
    const search=el('input');search.placeholder='搜索日历';search.style.cssText='width:100%;padding:10px';const checks=el('div');checks.style.cssText='max-height:270px;overflow:auto;margin:12px 0';
    function render(){checks.replaceChildren(...list.calendars.filter(c=>c.name.toLowerCase().includes(search.value.toLowerCase())).map(c=>{const label=el('label');label.style.cssText='display:block;padding:8px;border-bottom:1px solid #dde5d5';const box=el('input');box.type='checkbox';box.checked=chosen.has(c.id);box.disabled=!c.readable||busy;box.onchange=()=>box.checked?chosen.add(c.id):chosen.delete(c.id);label.append(box,document.createTextNode(' '+c.name+(c.readable?'':'（权限不足）')));return label;}));}search.oninput=render;render();
    const old=list.saved.find(c=>c.selected)?.sync_query,today=new Intl.DateTimeFormat('en-CA').format(new Date()),last=new Date();last.setDate(last.getDate()+180);
    const from=el('input'),to=el('input');from.type=to.type='date';from.value=old?.from||today;to.value=old?.to||new Intl.DateTimeFormat('en-CA').format(last);const a=el('label','起始日期 '),b=el('label','截止日期 ');a.append(from);b.append(to);
    const sync=el('button','同步并关联到我的任务');sync.style.cssText='display:block;padding:12px 18px;background:#315c52;color:white;border:0;border-radius:9px;margin-top:16px';card.append(search,checks,a,b,sync);status.textContent='请选择日历和日期范围。不会删除旧任务或历史积分。';
    sync.onclick=async()=>{if(busy)return;busy=true;sync.disabled=true;close.disabled=true;from.disabled=to.disabled=true;render();try{
      const saved=await api('selection',{input:{ids:[...chosen],from:from.value,to:to.value,timeZone:old?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone}});
      if(!chosen.size){status.textContent='已暂停所有日历同步；历史记录保留。';return;}
      let failures=0;for(const c of saved.calendars.filter(c=>c.selected)){status.textContent=`正在同步「${c.summary}」…`;const r=await api('sync',{calendarId:c.id});if(r.status!=='success')failures++;}
      let result;for(let batch=0;batch<60;batch++){status.textContent=`正在关联正式任务，第 ${batch+1} 批…`;result=await api('link');if(!result.results.some(r=>r.status==='pending'))break;}
      const pending=result.results.filter(r=>!['linked','created'].includes(r.status));status.textContent=`关联完成 ${result.results.length-pending.length} 项；${pending.length} 项需核对；${failures} 个日历同步失败。`;
      if(pending.length){const warning=el('p','存在疑似旧任务重复或未确认的写入，已暂停这些记录的自动创建，请保留本页结果供核对。');card.append(warning);}
      window.starcampTransport?.reset();const game=await fetch('/api/game?clientDate='+today,{cache:'no-store'}).then(r=>r.json());window.dispatchEvent(new CustomEvent('starcamp:game-data',{detail:game}));
      const refresh=el('button','刷新查看今日任务');refresh.onclick=()=>{sessionStorage.setItem('starcamp:return-tab','任务');location.reload();};card.append(refresh);
    }catch(e){status.textContent=e.message+'。不会盲目重试创建或发奖。';}finally{busy=false;sync.disabled=false;close.disabled=false;from.disabled=to.disabled=false;render();}};
  }catch(e){status.textContent=e.message;}
 }
 window.addEventListener('starcamp:game-data',e=>{latest=e.detail;mount();});window.addEventListener('starcamp:session-reset',()=>{latest=null;document.querySelectorAll('.owner-calendar-pilot').forEach(n=>n.remove());panel?.remove();panel=null;});
 let queued=false;new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;mount();});}}).observe(document.documentElement,{childList:true,subtree:true});
})();
