// Run via tabbit-cli nodejs, serving vercel-proxy at http://127.0.0.1:8765.
const writes=[];
await page.route('**/api/game?*',route=>route.fulfill({json:{quests:[{id:71,title:'触屏阅读测试',type:'主线',detail:'',done:false,dueAt:null}],user:{email:'sequence-test@example.com'}}}));
await page.route('**/api/sequence-record',route=>{writes.push(route.request().postData());return route.fulfill({status:500,json:{error:'测试不保存'}});});
await page.goto('http://127.0.0.1:8765/offline.html');
await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:8px;background:#edf5ea}.main-content{max-width:1280px;margin:auto}</style><link rel="stylesheet" href="/starlane-ui.css"><link rel="stylesheet" href="/starlane-addons.css"><link rel="stylesheet" href="/starlane-full-timeline.css?v=21"></head><body><nav class="nav-stack"><button class="nav-item"><small>营地</small></button><button class="nav-item"><small>任务</small></button></nav><main class="main-content">测试营地</main><script type="module" src="/starlane-ui.js?v=21"></script></body></html>');
await page.setViewportSize({width:1280,height:900});
await page.getByRole('button',{name:'时序',exact:true}).click();
const dateInput=page.locator('.starlane-compat-date input');
const today=await page.evaluate(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;});
await expect(dateInput).toHaveValue(today);
await dateInput.fill('2026-09-01');
await page.getByRole('button',{name:'30 min',exact:true}).click();
await expect(dateInput).toHaveValue('2026-09-01');
await page.getByRole('button',{name:'任务',exact:true}).click();
await page.getByRole('button',{name:'时序',exact:true}).click();
await expect(dateInput).toHaveValue(today);

// Test the same real pointer handler with touch/pen events, without writing user data.
async function drag(pointerType,width,height,index,ratio,cancel=false){
  await page.setViewportSize({width,height});
  const handle=page.locator('.sequence-drag-handle').first();
  await handle.scrollIntoViewIfNeeded();
  const p=await handle.boundingBox();
  await handle.dispatchEvent('pointerdown',{pointerId:42,pointerType,isPrimary:true,button:0,clientX:p.x+22,clientY:p.y+22,bubbles:true});
  await expect(page.locator('.sequence-drag-ghost')).toHaveCount(1);
  const lane=page.locator('.full-timeline-lane').nth(index);
  await lane.scrollIntoViewIfNeeded();
  const box=await lane.boundingBox(),x=box.x+box.width/2,y=box.y+box.height*ratio;
  await page.evaluate(({x,y,pointerType})=>window.dispatchEvent(new PointerEvent('pointermove',{pointerId:42,pointerType,isPrimary:true,clientX:x,clientY:y,bubbles:true,cancelable:true})),{x,y,pointerType});
  await expect(page.locator('.full-timeline-preview')).toHaveCount(1);
  const hint=await page.locator('.full-timeline-hint').innerText();
  await page.evaluate(({x,y,pointerType,cancel})=>window.dispatchEvent(new PointerEvent(cancel?'pointercancel':'pointerup',{pointerId:42,pointerType,isPrimary:true,clientX:x,clientY:y,bubbles:true,cancelable:true})),{x,y,pointerType,cancel});
  await expect(page.locator('.sequence-drag-ghost')).toHaveCount(0);
  await expect(page.locator('.full-timeline-preview')).toHaveCount(0);
  if(cancel){await expect(page.locator('.starlane-compat-editor-backdrop')).toHaveCount(0);return hint;}
  await expect(page.getByPlaceholder('例如：完成产品方案结构')).toHaveValue('触屏阅读测试');
  const times=await page.locator('.starlane-compat-editor-backdrop input[type=time]').evaluateAll(nodes=>nodes.map(n=>n.value));
  await page.getByRole('button',{name:'取消',exact:true}).click();
  return {hint,times};
}
const phone=await drag('touch',390,844,1,.5);
expect(phone.times).toEqual(['18:00','18:30']);
const tablet=await drag('pen',1024,1100,0,.5);
expect(tablet.times).toEqual(['06:00','06:30']);
await drag('touch',390,844,0,.5,true);

// Normal desktop HTML drag is retained.
await page.setViewportSize({width:1280,height:1000});
const transfer=await page.evaluateHandle(()=>{const d=new DataTransfer();d.setData('application/x-starcamp-task','71');return d;});
const desktopLane=page.locator('.full-timeline-lane').nth(1);await desktopLane.scrollIntoViewIfNeeded();
const desktopBox=await desktopLane.boundingBox();
await desktopLane.dispatchEvent('drop',{dataTransfer:transfer,clientY:desktopBox.y+desktopBox.height*.25});
await expect(page.getByPlaceholder('例如：完成产品方案结构')).toHaveValue('触屏阅读测试');
await expect(page.locator('.starlane-compat-editor-backdrop input[type=time]').first()).toHaveValue('15:00');
await page.getByRole('button',{name:'取消',exact:true}).click();

// Reopening a week still anchors to today; switching scale within it preserves choice.
await page.getByRole('button',{name:'周视图',exact:true}).click();
await dateInput.fill('2026-09-01');
await page.getByRole('button',{name:'10 min',exact:true}).click();
await expect(dateInput).toHaveValue('2026-09-01');
await page.getByRole('button',{name:'任务',exact:true}).click();
await page.getByRole('button',{name:'时序',exact:true}).click();
await expect(dateInput).toHaveValue(today);
await expect(page.locator('.full-timeline-lane')).toHaveCount(7);
await drag('touch',390,844,2,.5);
expect(writes.length).toBe(0);
await page.getByRole('button',{name:'日视图',exact:true}).click();
const edgeHandle=page.locator('.sequence-drag-handle').first();await edgeHandle.scrollIntoViewIfNeeded();
const edgePoint=await edgeHandle.boundingBox();
await edgeHandle.dispatchEvent('pointerdown',{pointerId:66,pointerType:'touch',isPrimary:true,button:0,clientX:edgePoint.x+22,clientY:edgePoint.y+22,bubbles:true});
const beforeScroll=await page.evaluate(()=>window.scrollY);
await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointermove',{pointerId:66,pointerType:'touch',clientX:180,clientY:12,cancelable:true})));
await page.waitForFunction(before=>window.scrollY<before,beforeScroll);
await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:66,pointerType:'touch',clientX:5,clientY:5,cancelable:true})));
await expect(page.locator('.starlane-compat-editor-backdrop')).toHaveCount(0);
await expect(page.locator('.sequence-drag-ghost')).toHaveCount(0);
await dateInput.fill('2026-09-01');
await page.evaluate(()=>{window.RealDate=Date;window.Date=class extends window.RealDate{constructor(...args){super(...(args.length?args:['2026-10-14T12:00:00']));}static now(){return new window.RealDate('2026-10-14T12:00:00').getTime();}};window.dispatchEvent(new Event('focus'));});
await expect(dateInput).toHaveValue('2026-10-14');
await page.evaluate(()=>{window.Date=window.RealDate;});
return {dateReentry:'today',dateDuringEditing:'preserved',phone,tablet,weekTouch:'passed',cancel:'no writes',desktop:'15:00',writes:writes.length};
