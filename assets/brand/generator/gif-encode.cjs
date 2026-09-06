// Encode PNG frames → animated GIF (gifenc + sharp). Run from repo root (needs node_modules).
//   FRAMESDIR=... OUT=out.gif WIDTH=460 SEQ='[[2,650],[3,720],...]' node assets/brand/generator/gif-encode.cjs
const sharp=require('sharp');const fs=require('fs');
const {GIFEncoder,quantize,applyPalette}=require('gifenc');
const DIR=process.env.FRAMESDIR, OUT=process.env.OUT, W=+(process.env.WIDTH||460);
const seq=JSON.parse(process.env.SEQ);
(async()=>{
  const gif=GIFEncoder();
  for(const [n,delay] of seq){
    const {data,info}=await sharp(`${DIR}/frame-${n}.png`).resize({width:W}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const rgba=new Uint8ClampedArray(data.buffer,data.byteOffset,data.length);
    const palette=quantize(rgba,256,{format:'rgb565'});
    const index=applyPalette(rgba,palette,'rgb565');
    gif.writeFrame(index,info.width,info.height,{palette,delay});
    console.log('frame',n,info.width+'x'+info.height,delay+'ms');
  }
  gif.finish();
  fs.writeFileSync(OUT,Buffer.from(gif.bytes()));
  console.log('GIF',OUT,(fs.statSync(OUT).size/1024/1024).toFixed(2)+'MB');
})();
