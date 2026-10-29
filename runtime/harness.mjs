import {mkdir,readFile,writeFile,rename,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
export function createHarness({infer,instructions,readJson,json}){
 const root=process.env.EUREKA_HARNESS_DIR||'/app/data/harness';
 let active=null;
 const controllers=new Map();
 const path=id=>join(root,id+'.json');
 const save=async job=>{await mkdir(root,{recursive:true});await writeFile(path(job.id)+'.tmp',JSON.stringify(job),{mode:0o600});await rename(path(job.id)+'.tmp',path(job.id))};
 const get=async id=>JSON.parse(await readFile(path(id),'utf8'));
 const initialized=(async()=>{await mkdir(root,{recursive:true});for(const name of await readdir(root)){if(!/^[a-f0-9-]{36}\.json$/.test(name))continue;const job=await get(name.slice(0,-5));if(['generating','testing'].includes(job.status)){job.status='interrupted';job.error='El runtime se reinició; crea una nueva versión.';await save(job)}}})();
 const schema={type:'object',additionalProperties:false,properties:{title:{type:'string'},html:{type:'string'},tests:{type:'array',items:{type:'object',additionalProperties:false,properties:{action:{type:'string',enum:['click','fill','visible']},selector:{type:'string'},value:{type:'string'}},required:['action','selector','value']}}},required:['title','html','tests']};
 async function execute(job,controller){
  try{
   let feedback='';
   for(let attempt=1;attempt<=2;attempt++){
    controller.signal.throwIfAborted();
    job.status='generating';job.attempt=attempt;await save(job);
    const output=await infer(instructions('em-installer-5-3','Crea una aplicación estática autocontenida para el harness. Devuelve JSON con title, html completo y tests (hasta 12 pasos click/fill/visible con selectores CSS estables). HTML, CSS y JavaScript inline, sin recursos externos, fetch, formularios externos, importaciones, backend ni dependencias. Usa datos de ejemplo solo si se indican como tales. No afirmes que ya fue probado. Incluye pruebas de navegación y botones importantes. Respeta el alcance solicitado.'),
      [{type:'input_text',text:job.prompt+feedback}],controller.signal,schema,{maxOutputTokens:12000});
    const draft=JSON.parse(output.text);
    if(typeof draft.html!=='string'||!draft.html.toLowerCase().includes('</html>')||Buffer.byteLength(draft.html)>500000||!Array.isArray(draft.tests)||draft.tests.length>12)throw Error('El modelo no devolvió un documento completo dentro de los límites.');
    job.title=draft.title;job.html=draft.html;job.status='testing';await save(job);
    const r=await fetch(process.env.EUREKA_HARNESS_URL+'/run',{method:'POST',headers:{authorization:'Bearer '+process.env.EUREKA_RUNTIME_API_TOKEN,'content-type':'application/json'},body:JSON.stringify({html:draft.html,tests:draft.tests}),signal:controller.signal});
    const result=await r.json();if(!r.ok)throw Error(result.error||'Falló el navegador');
    job.report=result;job.versions.push({attempt,providerResponseId:output.providerResponseId,status:result.status,at:new Date().toISOString()});
    if(result.status==='passed')break;
    feedback='\nCorrige esta versión usando los resultados reales del navegador. Documento anterior:\n'+draft.html+'\nResultados:\n'+JSON.stringify({...result,screenshot:undefined});
   }
   job.status=job.report.status==='passed'?'completed':'needs_revision';
  }catch(e){job.status=controller.signal.aborted?(controller.signal.reason?.name==='TimeoutError'?'timed_out':'cancelled'):'failed';job.error=String(e.message).slice(0,600)}
  finally{job.completedAt=new Date().toISOString();try{await save(job)}finally{active=null;controllers.delete(job.id)}}
 }
 return async(req,res,url)=>{
  if(!url.pathname.startsWith('/v1/harness/'))return false;
  await initialized;
  if(!process.env.EUREKA_HARNESS_URL){json(res,503,{error:'Harness no configurado'});return true}
  const match=url.pathname.match(/^\/v1\/harness\/jobs\/([a-f0-9-]{36})(?:\/(html|screenshot))?$/);
  try{
   if(req.method==='POST'&&url.pathname==='/v1/harness/jobs'){
    if(active){json(res,429,{error:'Hay una construcción en curso; espera a que termine.'});return true}
    active='reserving';
    let body;try{body=await readJson(req);if(typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>12000)throw Error('Describe la aplicación en hasta 12000 caracteres.')}catch(e){active=null;throw e}
    const job={id:randomUUID(),prompt:body.prompt,title:'Aplicación',status:'generating',createdAt:new Date().toISOString(),versions:[]};
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(new DOMException('La construcción excedió seis minutos.','TimeoutError')),360000);
    active=job.id;controllers.set(job.id,controller);
    try{await save(job)}catch(e){active=null;controllers.delete(job.id);clearTimeout(timer);throw e}
    json(res,202,{id:job.id,status:job.status});
    execute(job,controller).catch(console.error).finally(()=>clearTimeout(timer));return true;
   }
   if(match){
    const job=await get(match[1]);
    if(req.method==='DELETE'){controllers.get(job.id)?.abort();json(res,200,{cancellationRequested:controllers.has(job.id)});return true}
    if(req.method==='GET'){
     if(match[2]==='html'){json(res,200,{html:job.html||''});return true}
     if(match[2]==='screenshot'){json(res,200,{screenshot:job.report?.screenshot||''});return true}
     json(res,200,{...job,html:undefined,prompt:undefined,report:job.report?{...job.report,screenshot:undefined}:undefined});return true;
    }
   }
   json(res,404,{error:'Ruta no encontrada'});
  }catch(e){json(res,e.code==='ENOENT'?404:400,{error:e.message})}
  return true;
 };
}
