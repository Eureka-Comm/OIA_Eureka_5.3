const page=String.raw`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Eureka · Aplicaciones</title><style>
*{box-sizing:border-box}body{margin:0;background:#f7f8fa;color:#182230;font:15px system-ui}main{max-width:1100px;margin:40px auto;padding:24px}a{color:#157d65}textarea{width:100%;min-height:110px;padding:16px;border:1px solid #dce3e7;border-radius:16px;font:inherit}button{padding:12px 20px;border:0;border-radius:12px;background:#157d65;color:white;cursor:pointer;margin:12px 8px 12px 0}button:disabled{opacity:.5}iframe{width:100%;height:650px;border:1px solid #dce3e7;border-radius:16px;background:white}pre{white-space:pre-wrap;overflow-wrap:anywhere}img{max-width:100%}.muted{color:#657384}
</style><main><a href="/">← Volver al chat</a><h1>Aplicaciones de Eureka</h1><p class="muted">Describe una aplicación web. EM Installer prepara sus archivos y el harness ejecuta pruebas de navegador. Esta versión crea aplicaciones estáticas sin servicios externos.</p>
<textarea id="prompt" placeholder="Por ejemplo: una calculadora de presupuestos con tres categorías y un resumen…"></textarea><div><button id="build">Crear aplicación</button><button id="stop" disabled>Detener</button><button id="download" hidden>Descargar HTML</button></div><p id="status" role="status"></p><iframe id="preview" title="Vista previa aislada" sandbox="allow-scripts" referrerpolicy="no-referrer" hidden></iframe><details><summary>Resultados de las pruebas</summary><pre id="report"></pre><img id="shot" alt="Captura del navegador de pruebas" hidden></details></main>
<script>
const $=id=>document.getElementById(id);let id=localStorage.getItem('eureka-harness-job'),html='',polling=false;
async function api(path,options={}){const r=await fetch('/api/harness/'+path,{...options,headers:{'content-type':'application/json'},cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||('HTTP '+r.status));return data}
function status(text){$('status').textContent=text}
async function poll(){
 if(polling||!id)return;polling=true;
 try{
  const job=await api('jobs/'+id);status(({generating:'EM Installer está generando los archivos…',testing:'El navegador está probando la aplicación…',completed:'Aplicación lista. Pasaron las comprobaciones ejecutadas.',needs_revision:'La vista previa está disponible, pero algunas comprobaciones fallaron.',cancelled:'Trabajo detenido.',interrupted:'Trabajo interrumpido por reinicio.',failed:'Falló la construcción.'})[job.status]||job.status);
  if(job.error)status($('status').textContent+' '+job.error);
  const running=['generating','testing'].includes(job.status);$('build').disabled=running;$('stop').disabled=!running;
  if(job.report)$('report').textContent=JSON.stringify(job.report,null,2);
  if(!running){
   const data=await api('jobs/'+id+'/html');html=data.html;
   if(html){
    const policy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
    $('preview').srcdoc='<meta http-equiv="Content-Security-Policy" content="'+policy+'">'+html;$('preview').hidden=false;$('download').hidden=false;
   }
   const shot=await api('jobs/'+id+'/screenshot');if(shot.screenshot){$('shot').src='data:image/png;base64,'+shot.screenshot;$('shot').hidden=false}
  }else setTimeout(poll,2000);
 }catch(e){status(e.message+' Puedes recargar para recuperar el estado.');$('build').disabled=false}
 finally{polling=false}
}
$('build').onclick=async()=>{try{$('build').disabled=true;$('preview').hidden=true;const job=await api('jobs',{method:'POST',body:JSON.stringify({prompt:$('prompt').value})});id=job.id;localStorage.setItem('eureka-harness-job',id);poll()}catch(e){status(e.message);$('build').disabled=false}};
$('stop').onclick=async()=>{try{await api('jobs/'+id,{method:'DELETE'});status('Cancelación solicitada…')}catch(e){status(e.message)}};
$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([html],{type:'text/html'}));const a=document.createElement('a');a.href=url;a.download='eureka-application.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
if(id)poll();
</script></html>`;
export async function harnessPage(request){
 const url=new URL(request.url);
 if(url.pathname==='/factory')return new Response(page,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
 if(!/^\/api\/harness\/jobs(?:\/[a-f0-9-]{36}(?:\/(?:html|screenshot))?)?$/.test(url.pathname))return null;
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
 if(process.env.EUREKA_HARNESS_ENABLED!=='true')return reply({error:'Harness pendiente de activar en el servidor'},503);
 if(!['GET','POST','DELETE'].includes(request.method))return reply({error:'Método no admitido'},405);
 if(request.method!=='GET'&&(!request.headers.get('content-type')?.startsWith('application/json')||(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)))return reply({error:'Origen o tipo de solicitud no permitido'},403);
 const target=new URL(process.env.EUREKA_RUNTIME_INVOKE_URL);
 target.pathname=url.pathname.replace('/api/harness/','/v1/harness/');
 try{
  const body=request.method==='POST'?await request.text():undefined;
  if(body&&body.length>16000)return reply({error:'Solicitud demasiado grande'},413);
  const r=await fetch(target,{method:request.method,headers:{authorization:'Bearer '+process.env.EUREKA_RUNTIME_API_TOKEN,'content-type':'application/json'},body,signal:AbortSignal.timeout(10000)});
  return reply(await r.json(),r.status);
 }catch{return reply({error:'No se pudo contactar al harness. El trabajo puede seguir activo; recarga para consultar su estado.'},502)}
}
