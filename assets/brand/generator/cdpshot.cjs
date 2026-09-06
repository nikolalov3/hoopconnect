// Headless-Brave screenshot via DevTools Protocol (Node 24 built-in WebSocket, no deps).
// Plain `--screenshot` on this Mac captures only the app splash (fires before data loads)
// and the Brave process hangs on exit; driving it over CDP fixes both.
//
// Usage: node cdpshot.cjs <url> <out> <w> <h> <scale> <mobile 0|1> <waitSel> [extraMs] [clipSel] [transparent 0|1]
//   waitSel  — CSS selector to wait for before capturing (data-ready signal)
//   clipSel  — optional: capture only this element's bounding box (else full viewport)
//   transparent — optional: 1 = transparent page background (for cut-out PNGs)
const {spawn}=require('child_process');const fs=require('fs');
const [,, url, out, w, h, scale, mobile, waitSel, extraWait, clipSel, transparent]=process.argv;
const PORT=9400+Math.floor(Math.random()*400);
const B='/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const prof=process.env.PROF||'/tmp/brave-cdp-prof';
const br=spawn(B,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-sync','--disable-brave-update',`--user-data-dir=${prof}`,'--hide-scrollbars',`--remote-debugging-port=${PORT}`,`--window-size=${w},${h}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const die=(e)=>{console.error('ERR',e&&e.message||e);try{br.kill('SIGKILL')}catch{};process.exit(1)};
setTimeout(()=>die('timeout 90s'),90000);
(async()=>{
  let ok=false;for(let i=0;i<80;i++){try{await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();ok=true;break}catch{await sleep(500)}}
  if(!ok)throw new Error('devtools not reachable');
  const pg=await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`,{method:'PUT'})).json();
  const ws=new WebSocket(pg.webSocketDebuggerUrl);await new Promise((r,e)=>{ws.onopen=r;ws.onerror=e});
  let id=0;const pend={};ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id]}};
  const send=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params}))});
  await send('Emulation.setDeviceMetricsOverride',{width:+w,height:+h,deviceScaleFactor:+scale,mobile:mobile==='1'});
  if(transparent==='1') await send('Emulation.setDefaultBackgroundColorOverride',{color:{r:0,g:0,b:0,a:0}});
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.navigate',{url});
  let found=false;
  for(let i=0;i<80;i++){const r=await send('Runtime.evaluate',{expression:`!!document.querySelector(${JSON.stringify(waitSel)})`,returnByValue:true});if(r.result&&r.result.result&&r.result.result.value){found=true;break}await sleep(500)}
  if(!found)console.error('WARN selector not found:',waitSel);
  await sleep(+(extraWait||3000));
  const params={format:'png'};
  if(transparent==='1') params.captureBeyondViewport=true;
  if(clipSel){
    const r=await send('Runtime.evaluate',{expression:`(()=>{const e=document.querySelector(${JSON.stringify(clipSel)});if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}})()`,returnByValue:true});
    const box=r.result&&r.result.result&&r.result.result.value;
    if(!box)throw new Error('clip selector not found: '+clipSel);
    params.clip={x:box.x,y:box.y,width:box.width,height:box.height,scale:+scale};
  }
  const shot=await send('Page.captureScreenshot',params);
  fs.writeFileSync(out,Buffer.from(shot.result.data,'base64'));console.log('saved',out,fs.statSync(out).size);
  ws.close();br.kill('SIGKILL');process.exit(0);
})().catch(die);
