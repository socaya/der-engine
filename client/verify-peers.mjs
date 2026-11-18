import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
const p = await ctx.newPage();
await p.goto('http://localhost:5174/', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(500);
if (await p.locator('input[name="username"]').count()) {
  await p.fill('input[name="username"]', process.env.DER_BOOTSTRAP_ADMIN_USERNAME);
  await p.fill('input[name="password"]', process.env.DER_BOOTSTRAP_ADMIN_PASSWORD);
  await Promise.all([p.waitForNavigation({waitUntil:'networkidle'}).catch(()=>{}), p.click('button[type="submit"]')]);
}
await p.waitForTimeout(1500);
await p.goto('http://localhost:5174/peers', { waitUntil:'networkidle', timeout:15000 }).catch(()=>{});
await p.waitForTimeout(2000);
await p.screenshot({ path:'/tmp/peers-screen.png', fullPage:false });
const text = await p.evaluate(()=>document.body.innerText.slice(0,600));
console.log(text);
await b.close();
