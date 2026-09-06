const http=require('http'),fs=require('fs'),path=require('path');
const REPO='/Users/nikola/Desktop/hoopconnect/hoopconnect';
const OUT=path.join(REPO,'assets','brand'); fs.mkdirSync(OUT,{recursive:true});
http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x');
  if(req.method==='POST'&&u.pathname==='/save'){
    const name=(u.searchParams.get('name')||'').replace(/[^a-z0-9-]/gi,'');
    if(!name){res.writeHead(400);return res.end('bad name');}
    const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>{
      const buf=Buffer.concat(chunks); fs.writeFileSync(path.join(OUT,name+'.png'),buf);
      console.log('saved',name,buf.length); res.writeHead(200,{'content-type':'text/plain'});res.end('ok '+buf.length);});
    return;
  }
  if(u.pathname==='/'||u.pathname==='/lockup.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end(fs.readFileSync(path.join(__dirname,'lockup.html')));}
  if(u.pathname==='/hoop.svg'){res.writeHead(200,{'content-type':'image/svg+xml'});
    return res.end(fs.readFileSync(path.join(REPO,'assets','logo-crest.svg'),'utf8').replace('<svg ','<svg width="900" height="900" '));}
  res.writeHead(404);res.end();
}).listen(3987,()=>console.log('lockup server on 3987'));
