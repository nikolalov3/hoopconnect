const {spawn}=require('child_process');const fs=require('fs');
const B='/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const PROF=process.env.PROF, PORT=9783, OUT=process.env.OUT, SCALE=3;
const ns=JSON.parse(process.env.NS);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const br=spawn(B,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-sync','--disable-brave-update',`--user-data-dir=${PROF}`,'--hide-scrollbars','--window-size=520,900',`--remote-debugging-port=${PORT}`,'about:blank'],{stdio:'ignore'});
const die=e=>{console.error('ERR',e&&e.message||e);try{br.kill('SIGKILL')}catch{};process.exit(1)};
setTimeout(()=>die('overall timeout 100s'),100000);
(async()=>{
  let base;for(let i=0;i<40;i++){try{await(await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();base=1;break}catch{await sleep(500)}}
  if(!base)throw new Error('devtools nr');
  const t=await(await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`,{method:'PUT'})).json();
  const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise((r,e)=>{ws.onopen=r;ws.onerror=e});
  let id=0;const pend={};ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id]}};
  const send=(m,p={})=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method:m,params:p}))});
  await send('Page.enable');await send('Runtime.enable');
  for(const n of ns){
    await send('Page.navigate',{url:`http://localhost:3000/matchlab?club&n=${n}`});
    let ok=false;for(let i=0;i<30;i++){const r=await send('Runtime.evaluate',{expression:'!!document.querySelector(String.fromCharCode(35)+"screen")',returnByValue:true});if(r.result?.result?.value){ok=true;break}await sleep(400)}
    if(!ok)console.error('WARN no #screen n='+n);
    await sleep(2200);
    const rb=await send('Runtime.evaluate',{expression:'(()=>{const e=document.querySelector(String.fromCharCode(35)+"screen");const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}})()',returnByValue:true});
    const box=rb.result.result.value;
    const shot=await send('Page.captureScreenshot',{format:'png',clip:{...box,scale:SCALE}});
    fs.writeFileSync(`${OUT}/screen-${n}.png`,Buffer.from(shot.result.data,'base64'));
    console.error('saved n='+n,fs.statSync(`${OUT}/screen-${n}.png`).size);
  }
  ws.close();br.kill('SIGKILL');process.exit(0);
})().catch(die);
