import http from 'node:http';
import {spawn,execFile} from 'node:child_process';
import {randomUUID,timingSafeEqual} from 'node:crypto';
let busy=false;
const secret=process.env.EUREKA_RUNTIME_API_TOKEN;
if(!secret)throw Error('Missing runner authentication');
const equal=value=>{const a=Buffer.from(value||''),b=Buffer.from('Bearer '+secret);return a.length===b.length&&timingSafeEqual(a,b)};
http.createServer(async(req,res)=>{
 const reply=(status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body))};
 if(!equal(req.headers.authorization))return reply(401,{error:'Unauthorized'});
 if(req.method==='GET'&&req.url==='/health')return reply(200,{ok:true});
 if(req.method!=='POST'||req.url!=='/run')return reply(404,{error:'Not found'});
 if(busy)return reply(429,{error:'Browser busy; retry later'});
 busy=true;
 let timer, child, name;
 try{
  let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1048576)throw Error('Payload too large')}
  const input=JSON.parse(raw);
  if(typeof input.html!=='string'||!Array.isArray(input.tests)||input.tests.length>12)throw Error('Invalid job');
  name='eureka-browser-'+randomUUID();
  const args=['run','--rm','--init','--name',name,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','512m','--cpus','0.75','--pids-limit','128','--shm-size','128m','--tmpfs','/tmp:rw,nosuid,size=128m','-i','eureka-browser:1'];
  res.on('close',()=>{if(!res.writableEnded&&name){child?.kill();execFile('docker',['rm','-f',name],()=>{})}});
  const result=await new Promise((resolve,reject)=>{
   child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';
   child.on('error',reject);child.stdin.on('error',()=>{});
   child.stdout.on('data',b=>{out+=b;if(out.length>8000000){child.kill();reject(Error('Output limit exceeded'))}});
   child.stderr.on('data',b=>{err=(err+b).slice(-2000)});
   timer=setTimeout(()=>{child.kill();reject(Error('Browser job timeout'))},90000);
   child.on('close',code=>{if(code)reject(Error('Browser failed: '+err));else{try{resolve(JSON.parse(out))}catch{reject(Error('Invalid browser output'))}}});
   child.stdin.end(JSON.stringify(input));
  });
  reply(200,result);
 }catch(e){reply(502,{error:e.message})}
 finally{clearTimeout(timer);if(name)execFile('docker',['rm','-f',name],()=>{});busy=false}
}).listen(3100,'0.0.0.0');
