// Run through tabbit-cli nodejs with the vercel-proxy directory served at 127.0.0.1:8765.
let hold=false,releaseRequest,requestArrived;
await page.route('**/api/game?*',async route=>{
  if(hold){requestArrived();await new Promise(resolve=>releaseRequest=resolve);}
  await route.fulfill({json:{quests:[],user:{email:'test@example.com'}}});
});
await page.goto('http://127.0.0.1:8765/offline.html');
await page.setContent('<html><head><style>*{box-sizing:border-box}body{margin:0}</style><link rel="stylesheet" href="/starlane-ui.css"><link rel="stylesheet" href="/starlane-addons.css?v=5"><link rel="stylesheet" href="/starlane-flat.css?v=6"></head><body><div id="app"><nav class="nav-stack"><button class="nav-item"><small>营地</small></button><button class="nav-item"><small>任务</small></button></nav><main class="main-content"><p>测试营地</p></main></div><script type="module" src="/starlane-ui.js?v=6"></script></body></html>');
const frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true)))));
await page.getByRole('button',{name:'▥时轨'}).click();
await expect(page.getByRole('button',{name:'周视图'})).toBeVisible();
const date=await page.locator('.starlane-compat-date input').inputValue();
await page.locator('.starlane-compat-date input').fill('');
await expect(page.locator('.starlane-compat-date input')).toHaveValue(date);
await expect(page.getByRole('button',{name:'周视图'})).toBeVisible();
await page.getByRole('button',{name:'周视图'}).click();
await page.setViewportSize({width:390,height:844});
await frame();
await page.getByRole('button',{name:'＋ 手动填写'}).click();
await page.getByPlaceholder('例如：完成产品方案结构').fill('保留未保存草稿');
await frame();
await page.evaluate(()=>{window.originalTimeline=document.querySelector('.starlane-compat-page');});
for(let i=0;i<3;i++){
  await page.evaluate(()=>{
    const main=document.createElement('main');main.className='main-content';main.innerHTML='<section style="display:grid">后台刷新内容</section>';
    document.querySelector('.main-content').replaceWith(main);
    document.querySelector('.nav-stack').innerHTML='<button class="nav-item"><small>营地</small></button><button class="nav-item"><small>任务</small></button>';
  });
  await frame();
  await expect(page.locator('.main-content > .starlane-compat-page')).toHaveCount(1);
  await expect(page.locator('.starlane-nav')).toHaveCount(1);
  await expect(page.getByPlaceholder('例如：完成产品方案结构')).toHaveValue('保留未保存草稿');
  await expect(page.getByRole('button',{name:'周视图'})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.flat-week-hour')).toHaveCount(168);
  await expect(page.locator('.starlane-compat-scroll')).toHaveCount(0);
  assert.equal(await page.evaluate(()=>window.originalTimeline===document.querySelector('.starlane-compat-page')),true);
  await expect(page.locator('[data-starlane-hidden]')).not.toBeVisible();
}
await page.getByRole('button',{name:'取消',exact:true}).click();
await page.getByRole('button',{name:'任务',exact:true}).click();
await expect(page.locator('.starlane-compat-page')).toHaveCount(0);
await expect(page.locator('.main-content')).toContainText('后台刷新内容');
hold=true;
const pending=new Promise(resolve=>requestArrived=resolve);
await page.getByRole('button',{name:'▥时轨'}).click();await pending;
await page.getByRole('button',{name:'任务',exact:true}).click();
const returned=page.waitForResponse(response=>response.url().includes('/api/game?'));
hold=false;releaseRequest();await returned;await frame();
await expect(page.locator('.starlane-compat-page')).toHaveCount(0);
await page.getByRole('button',{name:'▥时轨'}).click();
await expect(page.getByRole('button',{name:'周视图'})).toBeVisible();
await page.evaluate(()=>{document.querySelector('#app').innerHTML='<main class="auth-page">邮箱登录</main>';});await frame();
await expect(page.locator('.starlane-compat-page')).toHaveCount(0);
await expect(page.locator('.starlane-compat-editor-backdrop')).toHaveCount(0);
return {emptyDate:'preserved',repeatedRemounts:3,draft:'preserved',fullWeekHours:168,staleRequest:'ignored',logout:'cleared'};
