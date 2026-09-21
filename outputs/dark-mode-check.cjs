const { chromium } = require('./dark-mode-tools/node_modules/playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  await page.route('**/api/**', route => {
    const url = route.request().url();
    if(url.includes('/auth/me/') || url.includes('/auth/token/refresh/')) return route.fulfill({status:401,json:{detail:'Signed out'}});
    const body = url.includes('student-profile') ? {name:'Min',university:'MIIT',skills:['React'],bio:'Computer science student',experience:'Campus projects',graduation_year:2027} : url.includes('/applications/') ? {results:[{id:'1',status:'under_review',created_at:'2026-09-20',job_details:{title:'Frontend Intern',company_name:'Campus Co'}}]} : {results:[],count:0};
    return route.fulfill({json:body});
  });
  await page.goto('http://localhost:3001',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.modern-app');
  await page.evaluate(async () => {
    const {default:React} = await import('/node_modules/.vite/deps/react.js');
    const {default:{createRoot}} = await import('/node_modules/.vite/deps/react-dom_client.js');
    const host = document.createElement('div');
    host.className = 'modern-app';
    document.querySelector('#root').style.display='none';
    document.body.append(host);
    window.fixtureRoot=createRoot(host);
    window.renderFixture=async (name,props) => {
      const {default:Component} = await import(`/src/components/${name}.tsx`);
      window.fixtureRoot.render(React.createElement(Component,{key:name,isOpen:true,onClose:()=>{},onEdit:()=>{},onSave:async()=>{},onAuthRequired:()=>{},...props}));
    };
  });
  const fixtures = [
    ['ProfilePreviewModal',{profile:{name:'Min',university:'MIIT',skills:['React'],bio:'Computer science student',experience:'Campus projects'}}],
    ['EditProfileModal',{userEmail:'min@example.test'}],
    ['MyApplicationsModal',{}],
    ['ApplicationModal',{job:{id:'1',title:'Frontend Intern',company:'Campus Co',skills:['React'],jobType:'Internship',compensation:'Paid',description:'Build campus tools'}}],
    ['InfoModals',{type:'about'}],
    ['InfoModals',{type:'contact'}],
    ['LoginModal',{initialMode:'login',userRole:'student'}],
    ['AuthActionPage',{path:'/password/reset/confirm/test/token/'}],
    ['NotificationsModal',{}],
  ];
  for (const theme of ['dark','light']) {
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    for (const [name,props] of fixtures) {
      await page.evaluate(([name,props])=>window.renderFixture(name,props),[name,props]);
      await page.waitForTimeout(650);
      const panels=await page.locator('body > .modern-app [class*="bg-"]').evaluateAll(nodes=>nodes.filter(e=>e.getBoundingClientRect().width && !e.className.includes('fixed inset-0')).map(e=>({classes:e.className,color:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor})));
      assert.ok(panels.length, name+' rendered');
      if(theme==='dark') for(const panel of panels) {
        const rgb=panel.bg.match(/[\d.]+/g)?.map(Number);
        if(rgb && (rgb.length<4 || rgb[3]>.3)) assert.ok(!rgb.slice(0,3).every(n=>n>180),`${name} has light panel: ${JSON.stringify(panel)}`);
      }
      if(name==='ProfilePreviewModal') {
        const card=page.locator('body > .modern-app [class~="bg-slate-50/70"]');
        const color=await card.evaluate(e=>getComputedStyle(e).backgroundColor);
        console.log(theme,'profile surface:',color);
        await page.screenshot({path:path.join(__dirname,`profile-${theme}.png`)});
      }
      if(name==='EditProfileModal' && theme==='dark') assert.equal(await page.locator('body > .modern-app label.text-white').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
      console.log('PASS',theme,name,props.type||'');
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async props=>{document.documentElement.dataset.theme='dark';await window.renderFixture('ProfilePreviewModal',props)},fixtures[0][1]);
  await page.waitForTimeout(650);
  assert.ok(await page.locator('[role="dialog"]').evaluate(e=>e.getBoundingClientRect().right<=innerWidth));
  await page.screenshot({path:path.join(__dirname,'profile-dark-mobile.png')});
  const close=page.getByRole('button',{name:'Close profile preview'});
  await close.hover();
  await page.waitForTimeout(250);
  assert.equal(await close.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(48, 66, 75)');
  console.log('PASS mobile profile and dark hover');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
