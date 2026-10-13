// Pointer-based tray dragging: a dedicated handle leaves normal list scrolling intact.
export function installTaskTouchDrag({panel,lanes,onPreview,onClear,onDrop}) {
  let active=null,frame=0,suppressUntil=0,suppressCard=null;
  const root=()=>panel.closest('.starlane-compat-page, .star-lane-page');
  const targetAt=(x,y)=>document.elementsFromPoint(x,y).map(node=>node.closest?.('.full-timeline-lane')).find(lane=>lanes.includes(lane));
  function paint(){
    if(!active)return;
    const {x,y,ghost,title}=active;
    ghost.style.left=`${Math.max(8,Math.min(window.innerWidth-220,x-100))}px`;
    ghost.style.top=`${Math.max(8,y-64)}px`;
    const lane=targetAt(x,y);
    active.lane=lane;
    ghost.textContent=lane?`${title} · 松开放入此处`:`${title} · 拖到时间轴`;
    if(lane)onPreview(lane,{clientX:x,clientY:y},title);else onClear();
  }
  function tick(){
    if(!active)return;
    const {x,y}=active,edge=64,height=window.innerHeight;
    const speed=y<edge?-Math.ceil((edge-y)/edge*16):y>height-edge?Math.ceil((y-height+edge)/edge*16):0;
    if(speed){
      // Scroll the nearest scrollable ancestor, then the document (mobile/desktop layouts).
      let node=document.elementFromPoint(x,Math.max(0,Math.min(height-1,y))),scrolled=false;
      while(node&&node!==document.body){
        if(node.scrollHeight>node.clientHeight&&/(auto|scroll)/.test(getComputedStyle(node).overflowY)){
          const before=node.scrollTop;node.scrollTop+=speed;if(node.scrollTop!==before){scrolled=true;break;}
        }
        node=node.parentElement;
      }
      if(!scrolled)window.scrollBy(0,speed);
      paint();
    }
    frame=requestAnimationFrame(tick);
  }
  function cleanup(){
    if(!active)return;
    const old=active;active=null;cancelAnimationFrame(frame);
    old.ghost.remove();old.card.classList.remove('sequence-task-dragging');
    if(old.handle.hasPointerCapture?.(old.id))old.handle.releasePointerCapture(old.id);
    onClear();
    window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);
    window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);
    document.removeEventListener('visibilitychange',visibility);
  }
  function cancel(){if(active){suppressCard=active.card;suppressUntil=Date.now()+500;}cleanup();}
  function visibility(){if(document.hidden)cancel();}
  function move(event){
    if(!active||event.pointerId!==active.id)return;
    event.preventDefault();active.x=event.clientX;active.y=event.clientY;
    active.moved ||= Math.hypot(active.x-active.startX,active.y-active.startY)>6;
    paint();
  }
  function up(event){
    if(!active||event.pointerId!==active.id)return;
    event.preventDefault();move(event);
    const {card,taskId,lane,x,y,moved}=active;
    suppressCard=card;suppressUntil=Date.now()+500;cleanup();
    if(moved&&lane&&panel.isConnected)onDrop(taskId,lane,{clientX:x,clientY:y});
    else if(!moved){suppressUntil=0;card.click();suppressUntil=Date.now()+500;}
  }
  function down(event){
    if(event.button!==0||event.isPrimary===false)return;
    const handle=event.target.closest?.('.sequence-drag-handle');
    const card=handle?.closest('.starlane-task-item');
    if(!card||card.disabled||!root()?.contains(card))return;
    const taskId=Number(card.dataset.sequenceTaskId);if(!Number.isSafeInteger(taskId)||taskId<=0)return;
    event.preventDefault();event.stopPropagation();cleanup();
    const ghost=document.createElement('div');ghost.className='sequence-drag-ghost';ghost.setAttribute('role','status');document.body.append(ghost);
    active={id:event.pointerId,card,handle,taskId,title:card.querySelector('b')?.textContent||'任务',ghost,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false,lane:null};
    card.classList.add('sequence-task-dragging');
    try{handle.setPointerCapture?.(event.pointerId);}catch{/* Detached/synthetic pointer: window listeners still allow safe cancellation. */}
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);
    window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',visibility);
    paint();frame=requestAnimationFrame(tick);
  }
  function click(event){if(Date.now()<suppressUntil&&suppressCard?.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();}}
  function nativeDrag(event){if(event.target.closest?.('.sequence-drag-handle')||active)event.preventDefault();}
  document.addEventListener('pointerdown',down);document.addEventListener('click',click,true);document.addEventListener('dragstart',nativeDrag,true);
  return ()=>{cleanup();document.removeEventListener('pointerdown',down);document.removeEventListener('click',click,true);document.removeEventListener('dragstart',nativeDrag,true);};
}
