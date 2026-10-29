import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHarness} from '../runtime/harness.mjs';
test('asynchronous creation, test evidence, retrieval and missing projects',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'eureka-harness-test-'));
 process.env.EUREKA_HARNESS_DIR=dir;
 const browser=http.createServer(async(req,res)=>{for await(const chunk of req){}res.setHeader('content-type','application/json');res.end(JSON.stringify({status:'passed',tests:[{status:'passed'}],errors:[],screenshot:'',mobileOverflow:false}))});
 await new Promise(resolve=>browser.listen(0,'127.0.0.1',resolve));
 process.env.EUREKA_HARNESS_URL='http://127.0.0.1:'+browser.address().port;
 const handler=createHarness({infer:async()=>({text:JSON.stringify({title:'Test',html:'<!doctype html><html><button>OK</button></html>',tests:[]}),providerResponseId:'mock'}),instructions:()=>'',readJson:async req=>{let s='';for await(const b of req)s+=b;return JSON.parse(s)},json:(res,status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body))}});
 const app=http.createServer((req,res)=>handler(req,res,new URL(req.url,'http://localhost')));
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.address().port+'/v1/harness/jobs';
 try{
  const invalid=await fetch(base,{method:'POST',body:'{}'});assert.equal(invalid.status,400);
  const r=await fetch(base,{method:'POST',body:JSON.stringify({prompt:'Create a button'})});assert.equal(r.status,202);const {id}=await r.json();
  let job;for(let i=0;i<50;i++){job=await(await fetch(base+'/'+id)).json();if(job.status==='completed')break;await new Promise(r=>setTimeout(r,20))}
  assert.equal(job.status,'completed',job.error);assert.equal(job.report.status,'passed');assert.equal(job.html,undefined);
  assert.match((await(await fetch(base+'/'+id+'/html')).json()).html,/<button>/);
  assert.equal((await fetch(base+'/00000000-0000-0000-0000-000000000000')).status,404);
 }finally{await new Promise(r=>app.close(r));await new Promise(r=>browser.close(r));await rm(dir,{recursive:true,force:true})}
});