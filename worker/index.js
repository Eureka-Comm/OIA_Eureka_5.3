import { integrateApplication, renderApplicationPage } from "./applications.js";
import { createEurekaTask, invokeEurekaAgent, readEurekaCapabilities, requestEurekaTask } from "./eureka-runtime.js";

const roles = {
  core: { name: "EM Core", lane: "Orquestación adaptativa y gobierno. Integra resultados, determina el agente pertinente y comunica límites." },
  structurer: { name: "EM Structurer", lane: "Formula y evoluciona el problema, sus objetivos, límites, subproblemas y red de tareas." },
  descriptor: { name: "EM Descriptor", lane: "Describe estado, datos, relaciones y evidencia; distingue hechos, inferencias y vacíos." },
  predictor: { name: "EM Predictor", lane: "Analiza dinámica, escenarios, consecuencias y fuentes de incertidumbre; explicita supuestos." },
  prescriptor: { name: "EM Prescriptor", lane: "Evalúa objetivos, restricciones, alternativas, trade-offs y recomendaciones justificadas. No afirmes optimización matemática exacta sin solver." },
  actioner: { name: "EM Actioner", lane: "Convierte decisiones autorizadas en preparación, pasos verificables y observación. No ejecuta acciones externas." },
  installer: { name: "EM Installer", lane: "Diseña capacidades, sistemas de decisión y planes de implementación mantenibles." },
  publisher: { name: "EM Publisher", lane: "Comunica conocimiento validado según audiencia, objetivo y formato." }
};
const html = String.raw`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f7f8fa">
<title>Eureka · Espacio de trabajo</title>
<style>
:root{color-scheme:light;--bg:#f7f8fa;--surface:#fff;--ink:#182230;--muted:#687586;--line:#e4e9ef;--soft:#f2f5f8;--blue:#315ce8;--blue-dark:#2448c7;--green:#18845b;--red:#c44040;--shadow:0 18px 54px rgba(31,49,75,.08);--sans:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}*{box-sizing:border-box}html,body{height:100%;margin:0}body{background:var(--bg);color:var(--ink);font:15px/1.55 var(--sans)}button,textarea{font:inherit}button{cursor:pointer;color:inherit}button:focus-visible,textarea:focus-visible{outline:3px solid #92aafa;outline-offset:3px}.app{min-height:100%;display:flex;flex-direction:column}.topbar{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,5vw,72px);border-bottom:1px solid rgba(222,229,237,.78);background:rgba(255,255,255,.68)}.brand{display:flex;align-items:center;gap:11px;text-decoration:none;color:var(--ink);font-weight:680;letter-spacing:-.035em;font-size:18px}.brand-mark{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(145deg,#4775fa,#3155df);color:white;box-shadow:0 4px 12px rgba(49,92,232,.2)}.brand-mark svg{width:19px;height:19px}.header-actions{display:flex;align-items:center;gap:12px}.connection-button{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:8px 13px;color:#435164;font-size:12px;font-weight:570;transition:border-color .18s,background .18s}.connection-button:hover{border-color:#cbd5e1;background:#fbfcfe}.status-dot{width:8px;height:8px;border-radius:50%;background:#aab3bf}.connection-button.ready .status-dot{background:#2da778;box-shadow:0 0 0 3px #e4f5ee}.connection-button.failed .status-dot{background:#d45959;box-shadow:0 0 0 3px #fbeaea}.new-chat{width:37px;height:37px;border:0;border-radius:12px;background:transparent;color:#647286;display:grid;place-items:center;transition:background .18s,color .18s}.new-chat:hover{background:#edf1f6;color:var(--ink)}.new-chat svg{width:19px;height:19px}.main{width:min(100%,920px);margin:0 auto;padding:clamp(44px,9vh,96px) 24px 50px;flex:1;display:flex;flex-direction:column}.welcome{margin:auto 0;transition:opacity .2s}.welcome.hidden{display:none}.eyebrow{display:flex;align-items:center;gap:9px;color:#718096;font-size:11px;font-weight:650;letter-spacing:.12em;text-transform:uppercase;margin-bottom:18px}.eyebrow-mark{width:6px;height:6px;background:#5578eb;border-radius:50%}h1{font-size:clamp(34px,5vw,54px);line-height:1.08;letter-spacing:-.055em;margin:0;color:#172235;font-weight:640}.intro{max-width:560px;margin:15px 0 32px;color:#69778a;font-size:16px;line-height:1.7}.compose{border:1px solid #dfe5ed;border-radius:20px;background:var(--surface);padding:17px 18px 13px;box-shadow:var(--shadow);transition:border-color .2s,box-shadow .2s}.compose:focus-within{border-color:#9caef3;box-shadow:0 18px 56px rgba(49,92,232,.11),0 0 0 4px rgba(49,92,232,.055)}textarea{display:block;width:100%;min-height:76px;max-height:200px;resize:vertical;border:0;outline:0!important;background:transparent;color:var(--ink);padding:0 1px;font-size:16px;line-height:1.6}textarea::placeholder{color:#9aa5b4}.compose-bottom{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:10px}.compose-tools{display:flex;align-items:center;gap:8px;min-width:0}.agent-wrap{position:relative}.agent-button{display:flex;align-items:center;gap:8px;border:1px solid transparent;background:transparent;padding:7px 9px;border-radius:10px;color:#536174;font-size:12px;font-weight:580;transition:background .18s}.agent-button:hover,.agent-button[aria-expanded=true]{background:var(--soft)}.agent-icon{width:19px;height:19px;border-radius:7px;background:#edf1ff;color:var(--blue);display:grid;place-items:center}.agent-icon svg{width:12px;height:12px}.chevron{font-size:10px;color:#8290a2;margin-left:2px}.send{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:11px;background:var(--blue);color:#fff;padding:10px 16px;font-size:13px;font-weight:620;box-shadow:0 4px 10px rgba(49,92,232,.18);transition:transform .15s,background .15s,opacity .15s}.send:hover{background:var(--blue-dark);transform:translateY(-1px)}.send:disabled{cursor:wait;opacity:.55;transform:none}.send svg{width:15px;height:15px}.attach-button{width:34px;height:34px;border:1px solid transparent;border-radius:10px;background:transparent;color:#778599;display:grid;place-items:center;transition:background .18s,color .18s}.attach-button:hover{background:var(--soft);color:#34445a}.attach-button svg{width:18px;height:18px}.attachment-list{display:flex;flex-wrap:wrap;gap:8px;padding:8px 0 2px}.attachment-list[hidden]{display:none}.attachment-chip{display:flex;align-items:center;gap:7px;max-width:min(100%,320px);padding:6px 8px 6px 10px;border:1px solid #e3e9f1;border-radius:10px;background:#f8faff;color:#59677a;font-size:11px}.attachment-chip-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.attachment-chip-size{color:#9aa4b2;white-space:nowrap}.attachment-remove{width:20px;height:20px;border:0;border-radius:6px;background:transparent;color:#8a96a5;line-height:1}.attachment-remove:hover{background:#e9eef5;color:#334155}.drop-active{border-color:#8099f1!important;background:#fbfcff!important}.file-hint{color:#9aa4b2;font-size:10px;margin-left:5px}.hint{margin-top:12px;color:#99a3b1;font-size:11px;text-align:center}.suggestions{display:flex;flex-wrap:wrap;gap:9px;margin-top:17px}.suggestion{border:1px solid #e3e8ef;background:rgba(255,255,255,.68);border-radius:999px;padding:8px 13px;color:#5f6d80;font-size:12px;transition:all .18s}.suggestion:hover{background:#fff;border-color:#cdd7e7;color:#26364c;transform:translateY(-1px)}.footer{padding-top:28px;display:flex;justify-content:center;color:#9aa4b2;font-size:11px}.messages{display:flex;flex-direction:column;gap:20px;padding-bottom:25px}.msg{max-width:760px;animation:rise .22s ease-out}.msg.user{align-self:flex-end;max-width:min(75%,620px);background:#eaf0ff;border:1px solid #dce5ff;border-radius:18px 18px 5px 18px;padding:13px 17px}.msg.assistant{align-self:flex-start;width:100%;padding:6px 3px}.who{font-size:11px;font-weight:680;color:#63728a;margin-bottom:6px}.msg.user .who{display:none}.msg p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.msg .meta{margin-top:11px;color:#919cac;font-size:11px}.typing{align-self:flex-start;color:#758296;font-size:13px;padding:7px 3px;animation:pulse 1.2s infinite}.popover{position:absolute;left:0;bottom:calc(100% + 9px);z-index:8;width:min(340px,calc(100vw - 40px));padding:8px;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 18px 42px rgba(23,36,55,.14);display:none;max-height:380px;overflow:auto}.popover.open{display:block;animation:rise .14s ease-out}.agent-option{width:100%;display:flex;align-items:flex-start;gap:11px;text-align:left;border:0;background:transparent;padding:10px;border-radius:10px}.agent-option:hover,.agent-option.selected{background:#f4f6fb}.option-icon{flex:0 0 28px;height:28px;border-radius:9px;background:#eef2ff;color:#3a5ee0;display:grid;place-items:center;font-size:12px;font-weight:700}.option-text{min-width:0}.option-name{font-size:12px;font-weight:650;color:#27354a}.option-desc{font-size:10px;line-height:1.45;color:#8591a1;margin-top:2px}.popover-label{padding:7px 10px 5px;color:#a0a9b6;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.overlay{position:fixed;inset:0;z-index:20;background:rgba(25,38,57,.2);display:none;align-items:flex-start;justify-content:flex-end;padding:15px}.overlay.open{display:flex}.drawer{width:min(390px,100%);background:white;border:1px solid #e2e7ed;border-radius:20px;box-shadow:0 25px 70px rgba(20,33,52,.2);padding:22px;animation:slide .2s ease-out}.drawer-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}.drawer h2{font-size:18px;letter-spacing:-.025em;margin:0}.close{width:34px;height:34px;border:0;border-radius:10px;background:#f3f5f8;color:#657286;font-size:18px}.drawer-lead{font-size:12px;color:#7b8797;margin:0 0 18px}.status-card{padding:14px 15px;border:1px solid var(--line);border-radius:14px;margin:9px 0}.status-row{display:flex;align-items:center;justify-content:space-between;gap:14px;font-size:12px;font-weight:600}.state-label{display:flex;align-items:center;gap:8px;color:#4e5b6d}.state-light{width:8px;height:8px;border-radius:50%;background:#b4bdc8}.state-light.ok{background:#2da778}.state-light.bad{background:#d45959}.state-value{font-size:11px;color:#8995a5;font-weight:500}.status-detail{margin-top:7px;color:#929dad;font-size:11px;line-height:1.55}.note{margin-top:16px;padding:13px 14px;border-radius:12px;background:#f6f8fb;color:#788597;font-size:11px;line-height:1.6}.note b{color:#526176;font-weight:650}.screen-reader{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@keyframes rise{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}@keyframes slide{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:translateX(0)}}@keyframes pulse{50%{opacity:.48}}@media(max-width:600px){.topbar{height:62px;padding:0 16px}.brand{font-size:16px}.main{padding:50px 17px 30px}.intro{font-size:14px;margin-bottom:25px}.compose{padding:14px;border-radius:17px}.compose-bottom{align-items:flex-end}.agent-button{padding:7px 6px;font-size:11px}.send{padding:10px 13px}.suggestions{gap:7px}.suggestion{font-size:11px;padding:8px 11px}.msg.user{max-width:90%}.connection-button{font-size:11px;padding:7px 10px}.footer{padding-top:20px}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
</style>
</head>
<body>
<div class="app" id="app">
  <header class="topbar">
    <a class="brand" href="#" aria-label="Eureka Multiverse inicio">Eureka Multiverse</a>
    <div class="header-actions">
      <button class="connection-button" id="connectionButton" type="button" aria-haspopup="dialog" aria-expanded="false"><span class="status-dot" aria-hidden="true"></span><span id="connectionLabel">Comprobando conexión</span></button>
      <button class="new-chat" id="newChat" type="button" aria-label="Nueva conversación" title="Nueva conversación"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>
    </div>
  </header>
  <main class="main" id="main">
    <section class="welcome" id="welcome">
      <div class="eyebrow"><span class="eyebrow-mark"></span> Eureka Multiverse · 5.3</div>
      <h1>¿Qué quieres resolver?</h1>
      <p class="intro">Conecta el runtime de Eureka para que EM Core organice el trabajo y convoque a sus agentes.</p>
      <form class="compose" id="composer">
        <label class="screen-reader" for="messageInput">Escribe tu pregunta</label>
        <textarea id="messageInput" rows="2" placeholder="Escribe una pregunta o describe tu reto…"></textarea>
        <input class="screen-reader" id="fileInput" type="file" multiple aria-label="Elegir archivos para adjuntar">
        <div class="attachment-list" id="attachmentList" hidden></div>
        <div class="screen-reader" id="attachmentStatus" role="status" aria-live="polite"></div>
        <div class="compose-bottom">
          <div class="compose-tools">
            <button class="attach-button" id="attachButton" type="button" aria-label="Adjuntar archivos" aria-describedby="fileHelp" title="Adjunta archivos de cualquier tipo (máx. 50 MB por envío)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.4 11.1-8.9 8.9a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg></button>
            <span class="screen-reader" id="fileHelp">Hasta 10 archivos, 50 MB en total. Se envían como adjuntos al runtime; la lectura depende de las capacidades del agente.</span>
            <div class="agent-wrap"><div class="agent-button" aria-label="EM Core coordina el trabajo y enruta a especialistas cuando corresponde"><span class="agent-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 13.5c1.1 1.3 2.3 2 3.5 2s2.4-.7 3.5-2M9 9.5h.01M15 9.5h.01"/></svg></span><span>EM Core · coordinación</span></div></div>
          </div>
          <button class="send" id="sendButton" type="submit" disabled><span>Enviar</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button>
        </div>
      </form>
      <div class="hint" id="runtimeHint">El chat se habilitará cuando el runtime real de Eureka confirme capacidades disponibles.</div>
      <div class="suggestions" aria-label="Ideas para empezar">
        <button class="suggestion" type="button" data-prompt="Ayúdame a estructurar este problema: ">Estructurar un problema</button>
        <button class="suggestion" type="button" data-prompt="Compara estas alternativas y explica sus trade-offs: ">Comparar alternativas</button>
      </div>
    </section>
    <section class="messages" id="messages" aria-live="polite" aria-label="Conversación"></section>
    <div class="footer" id="footer">Tus conversaciones no se guardan todavía.</div>
  </main>
</div>
<div class="overlay" id="connectionOverlay" role="dialog" aria-modal="true" aria-labelledby="connectionTitle">
  <section class="drawer">
    <div class="drawer-head"><h2 id="connectionTitle">Estado del espacio</h2><button class="close" id="closeConnections" type="button" aria-label="Cerrar">×</button></div>
    <p class="drawer-lead">Servicios disponibles para esta conversación.</p>
    <div class="status-card"><div class="status-row"><span class="state-label"><i class="state-light" id="bridgeLight"></i>Servidor de Eureka</span><span class="state-value" id="bridgeStatus">Comprobando</span></div><div class="status-detail" id="bridgeDetail">Consultando el estado del backend.</div></div>
    <div class="status-card"><div class="status-row"><span class="state-label"><i class="state-light" id="eurekaLight"></i>API de agentes Eureka</span><span class="state-value" id="eurekaStatus">Comprobando</span></div><div class="status-detail" id="eurekaDetail">Esperando confirmación del runtime de agentes.</div></div>
    <div class="status-card"><div class="status-row"><span class="state-label"><i class="state-light" id="factoryLight"></i>EM Factory · MCP</span><span class="state-value" id="factoryStatus">Comprobando</span></div><div class="status-detail" id="factoryDetail">La configuración no equivale a conexión validada.</div></div>
    <div class="status-card"><div class="status-row"><span class="state-label"><i class="state-light" id="mathLight"></i>Motor matemático</span><span class="state-value" id="mathStatus">Comprobando</span></div><div class="status-detail" id="mathDetail">La configuración no equivale a conexión validada.</div></div>
    <div class="note"><b>Estado de integraciones</b><br>Una capacidad aparece activa solo cuando su API confirma la conexión. Los perfiles de agentes no se muestran como invocados por el hecho de estar definidos.</div>
  </section>
</div>
<script>
const roleNames={core:'EM Core',structurer:'EM Structurer',descriptor:'EM Descriptor',predictor:'EM Predictor',prescriptor:'EM Prescriptor',actioner:'EM Actioner',installer:'EM Installer',publisher:'EM Publisher'};
const app=document.getElementById('app'),welcome=document.getElementById('welcome'),messages=document.getElementById('messages'),input=document.getElementById('messageInput'),send=document.getElementById('sendButton'),overlay=document.getElementById('connectionOverlay'),fileInput=document.getElementById('fileInput'),attachmentList=document.getElementById('attachmentList'),attachmentStatus=document.getElementById('attachmentStatus'),composer=document.getElementById('composer');let runtimeReady=false,currentTaskId=sessionStorage.getItem('eurekaTaskId')||null;const selectedFiles=[];const MAX_FILES=10,MAX_BYTES=50*1024*1024;
function formatSize(bytes){return bytes<1024?bytes+' B':bytes<1024*1024?(bytes/1024).toFixed(0)+' KB':(bytes/1024/1024).toFixed(1)+' MB'}
function renderAttachments(){attachmentList.replaceChildren();attachmentList.hidden=!selectedFiles.length;selectedFiles.forEach((file,index)=>{const chip=document.createElement('div');chip.className='attachment-chip';const name=document.createElement('span');name.className='attachment-chip-name';name.textContent=file.name;name.title=file.name;const size=document.createElement('span');size.className='attachment-chip-size';size.textContent=formatSize(file.size);const remove=document.createElement('button');remove.type='button';remove.className='attachment-remove';remove.setAttribute('aria-label','Quitar '+file.name);remove.textContent='×';remove.addEventListener('click',()=>{selectedFiles.splice(index,1);renderAttachments();attachmentStatus.textContent='Archivo quitado.'});chip.append(name,size,remove);attachmentList.append(chip)});attachmentStatus.textContent=selectedFiles.length?selectedFiles.length+' archivo'+(selectedFiles.length===1?'':'s')+' listo'+(selectedFiles.length===1?'':'s')+' para enviar.':''}
function addFiles(files){const incoming=Array.from(files);for(const file of incoming){if(selectedFiles.length>=MAX_FILES){attachmentStatus.textContent='Puedes adjuntar hasta 10 archivos por mensaje.';break}if(file.size>MAX_BYTES||selectedFiles.reduce((sum,item)=>sum+item.size,0)+file.size>MAX_BYTES){attachmentStatus.textContent='El tamaño combinado de los archivos no puede superar 50 MB.';continue}selectedFiles.push(file)}renderAttachments()}
function addMessage(who,text,meta,isUser=false){welcome.classList.add('hidden');document.getElementById('footer').style.display='none';const node=document.createElement('article');node.className='msg '+(isUser?'user':'assistant');const label=document.createElement('div');label.className='who';label.textContent=who;const body=document.createElement('p');body.textContent=text;node.append(label,body);if(meta){const extra=document.createElement('div');extra.className='meta';extra.textContent=meta;node.append(extra)}messages.appendChild(node);document.getElementById('main').scrollTop=document.getElementById('main').scrollHeight}




function resetChat(){messages.replaceChildren();welcome.classList.remove('hidden');document.getElementById('footer').style.display='flex';input.value='';selectedFiles.splice(0);currentTaskId=null;sessionStorage.removeItem('eurekaTaskId');renderAttachments();document.getElementById('main').scrollTop=0;input.focus()}
async function submitMessage(event){event?.preventDefault();const typed=input.value.trim();if((!typed&&!selectedFiles.length)||send.disabled)return;const message=typed||(selectedFiles.length===1?'Analiza el archivo adjunto.':'Analiza los archivos adjuntos.');const attached=[...selectedFiles];addMessage('Tú',message,attached.map(file=>'📎 '+file.name).join(' · '),true);input.value='';input.style.height='auto';selectedFiles.splice(0);renderAttachments();send.disabled=true;send.querySelector('span').textContent='Enviando';const wait=document.createElement('div');wait.className='typing';wait.textContent='Enviando al runtime de Eureka…';messages.appendChild(wait);try{if(!currentTaskId)currentTaskId=crypto.randomUUID();sessionStorage.setItem('eurekaTaskId',currentTaskId);const form=new FormData();form.set('message',message);form.set('taskId',currentTaskId);form.set('agent','core');for(const file of attached)form.append('files',file,file.name);const response=await fetch('/api/chat',{method:'POST',body:form});const data=await response.json();wait.remove();if(!response.ok){addMessage('Estado de la conexión',data.error||'No se pudo completar la invocación.',data.detail||data.dependency||'');return}if(data.taskId){currentTaskId=data.taskId;sessionStorage.setItem('eurekaTaskId',currentTaskId)}const product=data.product;const responseText=typeof data.text==='string'?data.text:typeof product==='string'?product:product?.text||JSON.stringify(product);const routed=Array.isArray(data.routedAgents)?data.routedAgents:[];const route=routed.length?'Especialistas convocados por Core: '+routed.map(key=>roleNames[key]||key).join(' · '):'EM Core · coordinación';addMessage(roleNames.core,responseText,route+' · invocación '+(data.invocationId||'confirmada')+' · estado: '+(data.status||'devuelto'))}catch{wait.remove();addMessage('Estado de la conexión','No se pudo contactar el backend.','Comprueba el servidor y el runtime de Eureka.')}finally{send.disabled=!runtimeReady;send.querySelector('span').textContent='Enviar';input.focus()}}
function setCapabilityAvailability(capabilities){runtimeReady=capabilities.some(item=>item.id==='core'&&item.status==='available');send.disabled=!runtimeReady;document.getElementById('runtimeHint').textContent=runtimeReady?'Enter para enviar · Shift + Enter para una nueva línea':'El chat se habilitará cuando el runtime real de Eureka confirme EM Core.'}
function setStatus(id,ok,label,detail){document.getElementById(id+'Light').className='state-light '+(ok?'ok':'bad');document.getElementById(id+'Status').textContent=label;document.getElementById(id+'Detail').textContent=detail}
async function refreshStatus(){const button=document.getElementById('connectionButton'),label=document.getElementById('connectionLabel');try{const response=await fetch('/api/status',{cache:'no-store'});const data=await response.json();const server=Boolean(response.ok);setStatus('bridge',server,server?'Disponible':'Sin respuesta',server?'El servidor web respondió correctamente.':'No se pudo confirmar el servidor.');setCapabilityAvailability(Array.isArray(data.eurekaCapabilities)?data.eurekaCapabilities:[]);const eureka=Boolean(data.eurekaRuntimeConnected);setStatus('eureka',eureka,eureka?'Conectada':'Pendiente',data.eurekaRuntimeReason||'El runtime confirmó las capacidades de agentes.');const factory=Boolean(data.factoryConfigured);setStatus('factory',factory,factory?'Configuración presente':'Pendiente',factory?'Hay URL y token; el intercambio MCP aún requiere verificación.':'Falta URL y autorización MCP de EM Factory.');const math=Boolean(data.mathEngineConfigured);setStatus('math',math,math?'URL configurada':'Pendiente',math?'Hay URL; el motor aún requiere validación de protocolo y resultados.':'Falta endpoint del motor matemático.');button.classList.toggle('ready',server&&eureka);button.classList.toggle('failed',!server||!eureka);label.textContent=!server?'Servidor sin respuesta':eureka?'Runtime Eureka conectado':'Runtime Eureka pendiente'}catch{setStatus('bridge',false,'Sin respuesta','No fue posible consultar /api/status.');setCapabilityAvailability([]);setStatus('eureka',false,'No confirmado','El estado del runtime de agentes no está disponible.');setStatus('factory',false,'No confirmado','No fue posible consultar la configuración de EM Factory.');setStatus('math',false,'No confirmado','No fue posible consultar la configuración del motor matemático.');button.classList.add('failed');label.textContent='Runtime Eureka no confirmado'}}
async function restoreTask(){if(!currentTaskId)return;try{const response=await fetch('/api/v1/tasks/'+encodeURIComponent(currentTaskId));if(!response.ok){sessionStorage.removeItem('eurekaTaskId');currentTaskId=null;return}const task=await response.json();for(const message of task.messages||[])addMessage(message.role==='user'?'Tú':roleNames.core,message.text,'',message.role==='user')}catch{}}
composer.addEventListener('submit',submitMessage);document.getElementById('attachButton').addEventListener('click',()=>fileInput.click());fileInput.addEventListener('change',()=>{addFiles(fileInput.files);fileInput.value=''});for(const eventName of ['dragenter','dragover'])composer.addEventListener(eventName,event=>{event.preventDefault();composer.classList.add('drop-active')});for(const eventName of ['dragleave','drop'])composer.addEventListener(eventName,event=>{event.preventDefault();composer.classList.remove('drop-active')});composer.addEventListener('drop',event=>addFiles(event.dataTransfer.files));input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submitMessage(e)}});document.getElementById('newChat').addEventListener('click',resetChat);document.querySelectorAll('.suggestion').forEach(button=>button.addEventListener('click',()=>{input.value=button.dataset.prompt||'';input.focus()}));document.getElementById('connectionButton').addEventListener('click',()=>{overlay.classList.add('open');document.getElementById('connectionButton').setAttribute('aria-expanded','true');document.getElementById('closeConnections').focus()});function closeOverlay(){overlay.classList.remove('open');document.getElementById('connectionButton').setAttribute('aria-expanded','false');document.getElementById('connectionButton').focus()}document.getElementById('closeConnections').addEventListener('click',closeOverlay);overlay.addEventListener('click',e=>{if(e.target===overlay)closeOverlay()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('open'))closeOverlay()});refreshStatus();restoreTask();
</script>
</body>
</html>`;
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "same-origin" } }); }
function encodeBase64(bytes) { let binary = ""; for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length))); return btoa(binary); }
const imageTypes = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const mediaTypes = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", csv: "text/csv", tsv: "text/tsv", txt: "text/plain", md: "text/markdown", json: "application/json", html: "text/html", xml: "text/xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
async function readChatBody(request) { if ((request.headers.get("content-type") || "").includes("multipart/form-data")) { const form = await request.formData(); return { message: form.get("message"), taskId: form.get("taskId"), agent: form.get("agent"), files: form.getAll("files").filter(file => typeof file.arrayBuffer === "function") }; } const body = await request.json(); return { ...body, files: [] }; }
async function chat(request, env) {
  let body; try { body = await readChatBody(request); } catch { return json({ error: "No se pudo leer el mensaje o los archivos adjuntos." }, 400); }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 12000) : "";
  const key = "core";
  const files = body.files || [];
  if (!message && !files.length) return json({ error: "Escribe un mensaje o adjunta un archivo." }, 400);
  if (files.length > 10) return json({ error: "Puedes adjuntar hasta 10 archivos por mensaje." }, 413);
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > 50 * 1024 * 1024 || files.some(file => file.size > 50 * 1024 * 1024)) return json({ error: "El tamaño combinado de los archivos no puede superar 50 MB." }, 413);
  const fileParts = [];
  for (const file of files) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const image = imageTypes.has(ext);
    const type = file.type || mediaTypes[ext] || "application/octet-stream";
    const encoded = encodeBase64(new Uint8Array(await file.arrayBuffer()));
    const data = `data:${type};base64,${encoded}`;
    if (image) fileParts.push({ type: "input_image", image_url: data, detail: "auto", filename: file.name });
    else fileParts.push({ type: "input_file", filename: file.name, media_type: type, file_data: data });
  }
  const runtime = await readEurekaCapabilities(env);
  if (!runtime.connected) return json({ error: "El runtime real de Eureka todavía no está conectado.", detail: runtime.reason, dependency: "EUREKA_RUNTIME" }, 503);
  const capability = runtime.capabilities.find(item => item.id === key && item.status === "available");
  if (!capability) return json({ error: `La capacidad ${roles[key].name} no está disponible en el runtime conectado.`, dependency: key }, 503);
  const input = [{ type: "input_text", text: message || (files.length === 1 ? "Analiza el archivo adjunto." : "Analiza los archivos adjuntos.") }, ...fileParts];
  const taskId = typeof body.taskId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(body.taskId) ? body.taskId : crypto.randomUUID();
  const invocationRequest = new Request(request.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agent: key, task: message || "Analiza los archivos adjuntos.", taskId, input }) });
  const result = await invokeEurekaAgent(invocationRequest, env);
  return json({ ...result.body, routedAgents: result.body.routedAgents || [] }, result.status);
}
export default { async fetch(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" } });
  if (url.pathname === "/api/status" && request.method === "GET") {
    const eurekaRuntime = await readEurekaCapabilities(env);
    return json({ eurekaRuntimeConnected: eurekaRuntime.connected, eurekaRuntimeReason: eurekaRuntime.reason, eurekaCapabilities: eurekaRuntime.capabilities.map(({ id, status, version }) => ({ id, status, version })), factoryConfigured: Boolean(env.EM_FACTORY_MCP_URL && env.EM_FACTORY_OAUTH_TOKEN), mathEngineConfigured: Boolean(env.MATH_ENGINE_URL), applicationRenderer: true });
  }
  if (url.pathname === "/api/v1/eureka/capabilities" && request.method === "GET") {
    const result = await readEurekaCapabilities(env);
    return json(result, result.connected ? 200 : 503);
  }
  if (url.pathname === "/api/v1/eureka/invocations" && request.method === "POST") {
    let body; try { body = await request.clone().json(); } catch { return json({ error: "Se esperaba un cuerpo JSON." }, 400); }
    if (body.agent !== "core") return json({ error: "La interfaz envía intenciones a EM Core; solo Core decide qué especialistas convocar." }, 403);
    const result = await invokeEurekaAgent(request, env);
    return json(result.body, result.status);
  }
  if (url.pathname === "/api/v1/tasks" && request.method === "POST") {
    const result = await createEurekaTask(request, env);
    return json(result.body, result.status);
  }
  const taskMatch = url.pathname.match(/^\/api\/v1\/tasks\/([A-Za-z0-9_-]{1,128})(?:\/(events|messages))?$/);
  if (taskMatch && request.method === "GET") {
    const result = await requestEurekaTask(taskMatch[1], env, taskMatch[2] ? url.searchParams.get("after") || 0 : null);
    return json(result.body, result.status);
  }
  if (taskMatch && taskMatch[2] === "messages" && request.method === "POST") {
    let body; try { body = await request.json(); } catch { return json({ error: "Se esperaba un cuerpo JSON." }, 400); }
    if (typeof body.task !== "string" || !body.task.trim()) return json({ error: "El campo task es obligatorio." }, 400);
    const invocation = new Request(request.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, agent: "core", taskId: taskMatch[1] }) });
    const result = await invokeEurekaAgent(invocation, env);
    return json(result.body, result.status);
  }
  const artifactMatch = url.pathname.match(/^\/api\/artifacts\/(artifact_[a-f0-9-]{36})(?:\/(integrate))?$/);
  if (artifactMatch && request.method === "GET" && !artifactMatch[2]) {
    const artifact = await env.appStore?.getArtifact(artifactMatch[1]);
    return artifact ? json(artifact) : json({ error: "No se encontró el artefacto." }, 404);
  }
  if (artifactMatch && request.method === "POST" && artifactMatch[2] === "integrate") {
    let body; try { body = await request.json(); } catch { return json({ error: "Falta la confirmación de integración." }, 400); }
    if (body.confirm !== true) return json({ error: "Confirma la integración desde Eureka-0." }, 400);
    try {
      const artifact = await integrateApplication(env.appStore, artifactMatch[1]);
      return artifact ? json(artifact) : json({ error: "No se encontró el artefacto." }, 404);
    } catch (error) { return json({ error: String(error.message || error) }, 409); }
  }
  const applicationMatch = url.pathname.match(/^\/tasks\/(task_[a-f0-9-]{36})\/apps\/(artifact_[a-f0-9-]{36})$/);
  if (applicationMatch && request.method === "GET") {
    const artifact = await env.appStore?.getArtifact(applicationMatch[2]);
    if (!artifact || artifact.taskId !== applicationMatch[1] || artifact.status !== "integrated") return new Response("Aplicación no encontrada", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    return new Response(renderApplicationPage(artifact), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; frame-ancestors 'self'" } });
  }
  if (url.pathname === "/api/chat" && request.method === "POST") return chat(request, env);
  if (url.pathname.startsWith("/api/")) return json({ error: "Ruta API no encontrada." }, 404);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" } });
} };

