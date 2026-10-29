const deadline=setTimeout(()=>process.exit(124),75000);
import { chromium } from 'playwright';
let raw=''; for await (const chunk of process.stdin) raw+=chunk;
const {html,tests=[]}=JSON.parse(raw);
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
 await context.route('**/*',route=>route.request().url()==='https://preview.invalid/'?route.fulfill({contentType:'text/html',body:html}):route.abort());
 const page=await context.newPage(); page.setDefaultTimeout(4000);
 const errors=[]; page.on('pageerror',e=>{if(errors.length<20)errors.push(e.message.slice(0,500))});
 page.on('dialog',d=>d.dismiss()); context.on('page',p=>{if(p!==page)p.close()});
 await page.goto('https://preview.invalid/',{waitUntil:'load',timeout:15000});
 const results=[];
 for(const test of tests.slice(0,12)){
  try{
   const locator=page.locator(test.selector);
   if(test.action==='click')await locator.click();
   else if(test.action==='fill')await locator.fill(test.value||'');
   else if(test.action==='visible'){if(!await locator.isVisible())throw Error('Elemento no visible')}
   else throw Error('Acción no admitida');
   results.push({...test,status:'passed'});
  }catch(e){results.push({...test,status:'failed',error:e.message.slice(0,500)})}
 }
 await page.setViewportSize({width:1280,height:800});
 const screenshot=(await page.screenshot({type:'png',timeout:10000})).toString('base64');
 await page.setViewportSize({width:390,height:844});
 const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
 process.stdout.write(JSON.stringify({tests:results,errors,mobileOverflow,screenshot,status:errors.length||results.some(t=>t.status==='failed')||mobileOverflow?'failed':'passed'}));
}finally{await browser.close();clearTimeout(deadline)}
