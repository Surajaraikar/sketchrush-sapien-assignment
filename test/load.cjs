const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const { io } = require('socket.io-client');
const ROOMS=Number(process.env.LOAD_ROOMS||20), SECONDS=Number(process.env.LOAD_SECONDS||15), PORT=Number(process.env.LOAD_PORT||3100);
const clients=[]; const latency=[]; const pending=new Map(); let errors=0, acknowledged=0, received=0;
const app=spawn(process.execPath,['server.cjs'],{env:{...process.env,NODE_ENV:'production',PORT:String(PORT)},stdio:['ignore','pipe','pipe']});
let output=''; app.stdout.on('data',x=>output+=x);app.stderr.on('data',x=>output+=x);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ack=(s,event,...args)=>new Promise(resolve=>s.timeout(5000).emit(event,...args,(e,v)=>resolve(e?{ok:false,error:String(e)}:v)));
const percentile=(list,p)=>{const a=[...list].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor(a.length*p))]||null;};
function sample(){try{const x=execFileSync('powershell',['-NoProfile','-Command',`$p=Get-Process -Id ${app.pid}; @($p.CPU,$p.WorkingSet64) -join ','`],{encoding:'utf8'}).trim().split(',').map(Number);return {cpuSeconds:x[0],rssMb:Math.round(x[1]/1048576)};}catch{return null;}}
(async()=>{
  for(let i=0;i<100&&!output.includes('SketchRush on');i++)await sleep(100);
  if(!output.includes('SketchRush on'))throw Error(`Server failed: ${output}`);
  for(let n=0;n<ROOMS;n++){
    const trio=[];for(let j=0;j<3;j++){const s=io(`http://localhost:${PORT}`,{reconnection:false,transports:['websocket']});await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});clients.push(s);trio.push(s);}
    const c=await ack(trio[0],'room:create',{name:'Host',rounds:1,duration:120});if(!c.ok)throw Error(JSON.stringify(c));
    for(let j=1;j<3;j++){const r=await ack(trio[j],'room:join',{code:c.code,name:`Player${j}`});if(!r.ok)throw Error(JSON.stringify(r));}
    const choices=new Promise(resolve=>trio[0].once('word:choices',resolve));await ack(trio[0],'room:start');await ack(trio[0],'word:select',(await choices)[0]);
    trio[1].on('canvas:op',op=>{received++;const started=pending.get(op.clientTag);if(started){latency.push(performance.now()-started);pending.delete(op.clientTag);}});
  }
  const before=sample(), started=performance.now(); let sequence=0;
  const workers=Array.from({length:ROOMS},(_,n)=>(async()=>{const s=clients[n*3];while(performance.now()-started<SECONDS*1000){const tag=`${n}:${sequence++}`;pending.set(tag,performance.now());const r=await ack(s,'canvas:op',{type:'stroke',points:[[.1,.1],[.2,.2]],color:'#171d30',size:5,clientTag:tag});if(r.ok)acknowledged++;else{errors++;pending.delete(tag);}await sleep(20);}})());
  await Promise.all(workers);await sleep(500);const after=sample();const elapsed=(performance.now()-started)/1000;
  const result={date:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch,cpus:require('node:os').cpus().length,rooms:ROOMS,players:ROOMS*3,seconds:Math.round(elapsed*10)/10,serverMode:'production',transport:'websocket'},events:{acknowledged,received,errors,strokesPerSecond:Math.round(acknowledged/elapsed),deliveryRatio:acknowledged?received/acknowledged:0},broadcastLatencyMs:{p50:percentile(latency,.5),p95:percentile(latency,.95),p99:percentile(latency,.99)},server:{rssStartMb:before?.rssMb,rssEndMb:after?.rssMb,cpuSecondsUsed:before&&after?Math.round((after.cpuSeconds-before.cpuSeconds)*100)/100:null,cpuPercentOneCore:before&&after?Math.round((after.cpuSeconds-before.cpuSeconds)/elapsed*100):null}};
  fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync(`artifacts/load-${ROOMS}-rooms.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{clients.forEach(s=>s.disconnect());app.kill();});
