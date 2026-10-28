'use strict';
(() => {
const URL = 'https://opixtuuscvdwmpkcbhzp.supabase.co';
const KEY = 'sb_publishable_XnVpLzQ8ZXHxT4BLpyd1eA_s55x8zYT';
const client = window.supabase.createClient(URL, KEY, {auth:{storageKey:'gh-online-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const $ = id => document.getElementById(id);
const HISTORY = 'gh34-pedido-guiado-historico-v1';
const PROD = 'guedes-hub-production-v1';
const SAL = 'guedes-salgados-v1';
const records = new Map([[HISTORY,'gh_pedidos'],[PROD,'gh_operacao_central'],[SAL,'gh_operacao_central']]);
const unitKeys = new Set(['gh27-pedido-guiado-catalogo-v2','gh43-pedido-modelos-v1','gh38-politicas-estoque-v1','guedes-hub-2.2-rascunhos','guedes_hub_install_invite_dismissed_v1']);
let user=null, profile=null, units=[], queue=[], memory=new Map(), view=new Map(), remote=new Map(), timer, flushing=false, loaded=false, frameDirty=false, revision=0, loading=false, lastSuccess='', connectionError='';
const admin=()=>profile?.perfil==='administrador';
const clone = x => JSON.parse(JSON.stringify(x));
const stable = x => x===null || typeof x!=='object' ? JSON.stringify(x) : Array.isArray(x) ? '['+x.map(stable).join(',')+']' : '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';
const same=(a,b)=>stable(a)===stable(b);
let tabId=sessionStorage.getItem('gh-online-tab-v1');
if(!tabId){tabId=crypto.randomUUID();sessionStorage.setItem('gh-online-tab-v1',tabId);}
const qprefix=()=> 'gh-online-pendentes-v1:'+user.id;
const qkey=()=>qprefix()+':'+tabId;
function otherQueues(){if(!user)return [];const a=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key!==qkey()&&(key===qprefix()||key.startsWith(qprefix()+':'))){try{const data=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(data)&&data.length)a.push({key,data,text:localStorage.getItem(key)});}catch{}}}return a;}
const scope=()=>admin()?'central':profile.unidade_codigo;
const docid=(s,k)=>s+'/'+k;
const recordid=(key,id)=>key+'/'+id;
const isUUID=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const parseArray=s=> { const a=JSON.parse(s||'[]');if(!Array.isArray(a))throw Error('Formato de histórico inválido.');return a; };
function notice(text){$('notice').textContent=text;$('notice').hidden=!text;}
function persist(){const text=JSON.stringify(queue);if(text.length>8_000_000)throw Error('Fila local muito grande. Exporte um backup e sincronize antes de continuar.');localStorage.setItem(qkey(),text);}
function report(text){connectionError=text;status();notice(text);}
function status(){
 const failed=queue.filter(x=>x.error).length;
 $('syncStatus').textContent=connectionError || (queue.length ? queue.length+' alteração(ões) pendente(s)'+(failed?' · '+failed+' exigem atenção':' · aguardando confirmação do banco') : lastSuccess?'Banco atualizado às '+lastSuccess:'Dados carregados do banco');
 $('pendingPanel').hidden=queue.length===0;
 $('recover').hidden=otherQueues().length===0;
 $('pendingList').replaceChildren();
 for(const op of queue){const el=document.createElement('div');el.className='pendingItem';const title=document.createElement('strong');title.textContent=op.key+(op.record?.date?' · '+op.record.date:'');el.append(title);const p=document.createElement('p');p.textContent=op.error||'Aguardando sincronização';el.append(p);if(op.error){const b=document.createElement('button');b.className='secondary';b.textContent='Exportar e descartar esta alteração';b.onclick=()=>discard(op.id);el.append(b);}$('pendingList').append(el);}
}
function download(name,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=window.URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>window.URL.revokeObjectURL(a.href),5000);}
function validateRecord(key,r){
 if(!r||typeof r!=='object'||Array.isArray(r)||!r.id||typeof r.id!=='string')throw Error('Registro sem identificação válida.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date||''))throw Error('Registro sem data válida.');
 if(key===HISTORY){if(!units.some(u=>u.codigo===r.unit))throw Error('Unidade não autorizada.');}
 else if(!admin())throw Error('Produção e salgados são exclusivos do administrador.');
}
function storageSet(key,value){
 if(!user||!loaded)throw Error('Faça login antes de salvar.');
 if(!/^(gh[0-9]*|guedes)[_-][a-zA-Z0-9_.-]+$/.test(key))throw Error('Chave de dados não autorizada.');
 if(memory.get(key)===value)return;
 const previous=queue;
 const next=clone(queue);
 function add(op){const i=next.findIndex(x=>x.id===op.id);const old=i<0?null:next[i];op.rev=++revision;op.error=null;if(old){op.version=old.version;op.dbid=old.dbid;op.created=old.created;op.targetStatus=old.targetStatus||op.targetStatus;next[i]=op;}else next.push(op);}
 if(records.has(key)){
  const list=parseArray(value), before=parseArray(memory.get(key));const ids=new Set();
  for(const r of list){validateRecord(key,r);if(ids.has(r.id))throw Error('Identificação repetida no histórico.');ids.add(r.id);}
  if(before.some(r=>!ids.has(r.id)))throw Error('A remoção de registros sincronizados está bloqueada. Faça uma cópia antes de importar um backup.');
  for(const record of list){const old=before.find(x=>x.id===record.id);if(same(old,record))continue;
   const id=recordid(key,record.id);const base=view.get(id);
   if(key===HISTORY && base?.status==='enviado' && !admin())throw Error('Pedido enviado: somente o administrador pode corrigir. Duplique para criar um novo rascunho.');
   add({id,key,record:clone(record),dbid:base?.id||(isUUID(record.id)?record.id:crypto.randomUUID()),version:base?.versao??null,created:!base,targetStatus:base?.status||'rascunho'});
  }
 } else {
  if(!admin()&&!unitKeys.has(key))throw Error('Este módulo é exclusivo do administrador.');
  const id=docid(scope(),key),base=view.get(id);
  add({id,key,escopo:scope(),value:value===null?'null':value,version:base?.versao??null,created:!base});
 }
 queue=next;
 try{persist();}catch(e){queue=previous;throw e;}
 memory.set(key,value);connectionError='';status();clearTimeout(timer);timer=setTimeout(flush,1000);
}
async function all(table){let rows=[];for(let from=0;;from+=1000){const {data,error}=await client.from(table).select('*').order(table==='gh_documentos'?'chave':'id').range(from,from+999);if(error)throw error;rows.push(...data);if(data.length<1000)break;}return rows;}
function buildView(data){
 const map=new Map(),mem=new Map();
 for(const [key,table] of records){const rows=data[table].filter(r=>table==='gh_pedidos'||r.modulo===(key===PROD?'producao':'salgados'));const list=rows.map(r=>{const item={...r.dados,id:r.dados.id||r.id};map.set(recordid(key,item.id),r);return item;}).sort((a,b)=>(b.date||'').localeCompare(a.date||''));mem.set(key,JSON.stringify(list));}
 for(const d of data.gh_documentos){map.set(docid(d.escopo,d.chave),d);if(d.escopo===scope()||(d.escopo==='central'&&d.chave==='guedes-hub-catalogo-local-v1'))mem.set(d.chave,d.valor);}
 for(const op of queue){if(op.record){const a=parseArray(mem.get(op.key));const i=a.findIndex(x=>x.id===op.record.id);if(i<0)a.unshift(op.record);else a[i]=op.record;mem.set(op.key,JSON.stringify(a));}else mem.set(op.key,op.value);}
 view=map;memory=mem;
}
async function fetchRemote(){
 const names=['gh_pedidos','gh_operacao_central','gh_documentos'];const data={};
 await Promise.all(names.map(async name=>data[name]=(name==='gh_operacao_central'&&!admin())?[]:await all(name)));
 return data;
}
function mount(){frameDirty=false;const frame=$('appFrame');frame.hidden=false;frame.src='workspace.html?v=5.1.0';}
async function load(reload=false){
 if(loading||flushing||!user||!navigator.onLine)return;
 loading=true;const actor=user.id;
 try{const data=await fetchRemote();if(user?.id!==actor)return;remote=new Map(Object.entries(data));renderOrders();if(reload){buildView(data);mount();notice('');}else if(!loaded){buildView(data);loaded=true;window.GHCloud.ready=true;mount();}else{
  const changes=Object.entries(data).some(([table,rows])=>rows.some(r=>{let id;if(table==='gh_documentos')id=docid(r.escopo,r.chave);else{const key=table==='gh_pedidos'?HISTORY:r.modulo==='producao'?PROD:SAL;id=recordid(key,r.dados.id||r.id);}return view.get(id)?.versao!==r.versao;}));
  if(changes&&!queue.length)notice('Há dados novos no banco. Use Atualizar dados para carregar na área de trabalho sem perder o formulário aberto.');
 }
 connectionError='';status();
 }catch(e){if(user?.id===actor)report('Não foi possível atualizar: '+(e.message||String(e)));}finally{loading=false;}
}
function queryIdentity(q,op){return op.escopo?q.eq('escopo',op.escopo).eq('chave',op.key):q.eq('id',op.dbid);}
function matches(row,op){if(op.escopo)return row.valor===op.value;return same(row.dados,op.record)&&(op.key!==HISTORY||row.status===op.targetStatus);}
async function getCurrent(op){let q=client.from(op.escopo?'gh_documentos':records.get(op.key)).select('*');const r=await queryIdentity(q,op).maybeSingle();if(r.error)throw r.error;return r.data;}
async function write(op,actor){
 const table=op.escopo?'gh_documentos':records.get(op.key);
 // Reconcile lost responses and enforce the version seen when editing began.
 const current=await getCurrent(op);
 if(user?.id!==actor)throw Error('A sessão mudou durante a sincronização.');
 if(current&&matches(current,op))return current;
 if(current&&op.key===HISTORY&&same(current.dados,op.record)&&current.status==='rascunho'&&op.targetStatus==='enviado'&&op.version===null){
  const r=await client.from(table).update({status:'enviado'}).eq('id',current.id).eq('versao',current.versao).select('*');
  if(r.error)throw r.error;if(r.data.length!==1)throw Object.assign(Error('Conflito no envio do pedido.'),{conflict:true});return r.data[0];
 }
 if(op.version!==null&&(!current||current.versao!==op.version))throw Object.assign(Error('Conflito: o registro mudou em outro aparelho. Exporte sua alteração e atualize os dados.'),{conflict:true});
 if(op.version===null&&current)throw Object.assign(Error('Conflito: já existe um registro com esta identificação.'),{conflict:true});
 let q;
 if(op.version===null){let row;
  if(op.escopo)row={escopo:op.escopo,chave:op.key,valor:op.value};
  else if(op.key===HISTORY)row={id:op.dbid,unidade_codigo:op.record.unit,criado_por:actor,dados:op.record};
  else row={id:op.dbid,modulo:op.key===PROD?'producao':'salgados',data_referencia:op.record.date,dados:op.record};
  q=client.from(table).insert(row);
 }else{const patch=op.escopo?{valor:op.value}:op.key===HISTORY?{dados:op.record,status:op.targetStatus}:{dados:op.record,data_referencia:op.record.date};q=queryIdentity(client.from(table).update(patch),op).eq('versao',op.version);}
 const {data,error}=await q.select('*');if(error)throw error;if(data.length!==1)throw Object.assign(Error('Conflito ou edição não autorizada. A alteração foi preservada na fila.'),{conflict:true});
 let row=data[0];
 // Newly created orders are always drafts; submission is a separate audited update.
 if(op.key===HISTORY&&op.version===null&&op.targetStatus==='enviado'){
  const r=await client.from(table).update({status:'enviado'}).eq('id',row.id).eq('versao',row.versao).select('*');if(r.error)throw r.error;if(r.data.length!==1)throw Error('Rascunho salvo, mas o envio ainda não foi confirmado.');row=r.data[0];
 }
 return row;
}
async function flush(){
 if(flushing||loading||!loaded||!user||!navigator.onLine)return;
 flushing=true;const actor=user.id;
 try{
  for(const op0 of [...queue]){
   if(!user||actor!==user.id)break;
   const op=queue.find(x=>x.id===op0.id);if(!op||op.error)continue;const snapshot=clone(op);
   try{const row=await write(snapshot,actor);if(!user||actor!==user.id)break;
    view.set(snapshot.id,row);const live=queue.find(x=>x.id===snapshot.id);if(live?.rev===snapshot.rev)queue=queue.filter(x=>x.id!==snapshot.id);else if(live){live.version=row.versao;live.created=false;}
    persist();lastSuccess=new Date().toLocaleTimeString('pt-BR');connectionError='';
   }catch(e){if(user?.id!==actor)break;const live=queue.find(x=>x.id===snapshot.id);if(live){live.error=(e.message||String(e));persist();}report('Alteração preservada, mas ainda não confirmada pelo banco. Confira as pendências.');}
  }
 }finally{flushing=false;status();if(user&&actor===user.id){await load();if(queue.some(x=>!x.error))setTimeout(flush,50);}}
}
function renderOrders(){
 $('orderRows').replaceChildren();const rows=remote.get('gh_pedidos')||[];
 rows.sort((a,b)=>b.atualizado_em.localeCompare(a.atualizado_em));
 if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent='Nenhum pedido no banco. Crie e salve um Pedido Guiado na área de trabalho.';tr.append(td);$('orderRows').append(tr);return;}
 for(const row of rows){const tr=document.createElement('tr');const vals=[row.unidade_codigo+' · '+(row.dados.date||new Date(row.criado_em).toLocaleDateString('pt-BR')),row.status==='enviado'?'Enviado no sistema':'Rascunho',String(row.versao)];for(const value of vals){const td=document.createElement('td');td.textContent=value;tr.append(td);}const td=document.createElement('td');
  const open=document.createElement('button');open.className='secondary';open.textContent=row.status==='enviado'&&!admin()?'Consultar':'Abrir / editar';open.onclick=()=>openOrder(row);td.append(open);
  if(row.status==='rascunho'){const b=document.createElement('button');b.textContent='Enviar no sistema';b.onclick=()=>submit(row);td.append(b);}const history=document.createElement('button');history.className='secondary';history.textContent='Histórico';history.onclick=()=>audit(row.id);td.append(history);tr.append(td);$('orderRows').append(tr);
 }
}
function openOrder(row){
 const doc=$('appFrame').contentDocument;if(!doc)return;
 const id=row.dados.id||row.id;
 if(!view.has(recordid(HISTORY,id))||view.get(recordid(HISTORY,id)).versao!==row.versao){notice('Atualize os dados antes de abrir esta versão do pedido.');return;}
 doc.querySelector('[data-tab="guiado"]')?.click();doc.querySelector('[data-action="history"]')?.click();const b=[...doc.querySelectorAll('[data-action="history-open"]')].find(x=>x.dataset.id===id);b?.click();$('appFrame').scrollIntoView({behavior:'smooth'});
}
async function submit(row){
 if(queue.length){notice('Sincronize as alterações pendentes antes de enviar o pedido.');return;}
 if(!confirm('Enviar '+row.unidade_codigo+' no sistema? A unidade não poderá editar depois. O WhatsApp é separado.'))return;
 try{const id=recordid(HISTORY,row.dados.id||row.id);const base=view.get(id);if(base?.versao!==row.versao)throw Error('Atualize os dados antes de enviar.');const op={id,key:HISTORY,dbid:row.id,record:clone(row.dados),version:row.versao,created:false,targetStatus:'enviado',rev:++revision};queue.push(op);persist();status();await flush();if(!queue.length)notice('Pedido enviado no sistema.');}catch(e){report(e.message);}
}
async function discard(id){const op=queue.find(x=>x.id===id);if(!op)return;download('guedes-hub-alteracao-pendente.json',op);if(!confirm('Sua alteração foi exportada. Descartar esta pendência e carregar a versão do banco?'))return;queue=queue.filter(x=>x.id!==id);persist();status();if(queue.length)notice('Resolva as outras pendências antes de recarregar a área de trabalho.');else await load(true);}
async function audit(id){
 try{const table=id?'gh_pedidos_historico':'gh_alteracoes';let q=client.from(table).select('*').order('registrado_em',{ascending:false}).limit(100);if(id)q=q.eq('pedido_id',id);const {data,error}=await q;if(error)throw error;$('auditRows').replaceChildren();const title=document.createElement('p');title.textContent='Até 100 eventos mais recentes. Autor identificado pelo ID do usuário.';$('auditRows').append(title);for(const r of data){const d=document.createElement('details'),s=document.createElement('summary');s.textContent=new Date(r.registrado_em).toLocaleString('pt-BR')+' · '+(r.tabela||'Pedido')+' · '+r.operacao+' · autor '+r.autor_id;const pre=document.createElement('pre');pre.textContent=JSON.stringify({anterior:r.anterior,novo:r.novo},null,2);d.append(s,pre);$('auditRows').append(d);}if(!data.length)$('auditRows').append('Nenhum evento encontrado.');$('auditRows').parentElement.open=true;$('auditRows').scrollIntoView({behavior:'smooth'});}catch(e){report('Erro ao consultar histórico: '+e.message);}
}
async function importLocal(){
 if(!admin())return;
 if(!confirm('Importar dados antigos deste navegador? Registros já existentes não serão sobrescritos. Os dados antigos permanecem disponíveis para recuperação.'))return;
 let count=0,skipped=0;
 for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!/^(gh[0-9]*|guedes)[_-]/.test(key)||key.startsWith('gh-online-'))continue;const value=localStorage.getItem(key);try{
  if(records.has(key)){const old=parseArray(value),current=parseArray(memory.get(key));const add=old.filter(r=>!current.some(x=>x.id===r.id));if(add.length){storageSet(key,JSON.stringify([...current,...add]));count+=add.length;}}
  else if(!memory.has(key)){storageSet(key,value);count++;}else if(memory.get(key)!==value)skipped++;
 }catch(e){skipped++;}}
 notice(count+' registro(s)/configuração(ões) encaminhado(s) à fila; '+skipped+' item(ns) preservado(s) sem importar por diferença ou formato. Confira a sincronização.');await flush();
}
async function initialize(account){
 if(loading||user?.id===account.id&&loaded)return;
 try{
  user=account;profile=null;loaded=false;window.GHCloud.ready=false;$('appFrame').hidden=true;$('appFrame').removeAttribute('src');
  const p=await client.from('gh_perfis').select('*').eq('usuario_id',user.id).single();if(p.error)throw Error('Usuário sem perfil autorizado. Peça ao administrador para configurar seu acesso.');profile=p.data;
  const u=await client.from('gh_unidades').select('*').order('codigo');if(u.error)throw u.error;units=u.data;
  try{const saved=JSON.parse(localStorage.getItem(qkey())||'[]');if(!Array.isArray(saved))throw Error();queue=saved;revision=Math.max(0,...queue.map(x=>x.rev||0));}catch{throw Error('Fila local ilegível. Preserve os dados deste navegador antes de continuar.');}
  window.GHCloud.admin=admin();window.GHCloud.unitList=units.map(u=>[u.codigo,u.nome]);
  $('identity').textContent=profile.nome+' · '+(admin()?'Administrador':profile.unidade_codigo)+' · '+user.email;
  $('importLocal').hidden=!admin();$('login').hidden=true;$('workspace').hidden=false;await load();if(!loaded)throw Error('Não foi possível carregar os dados.');await flush();
 }catch(e){$('loginError').textContent=e.message;$('login').hidden=false;$('workspace').hidden=true;user=null;profile=null;loaded=false;}
}
function clearAccount(){window.GHCloud.ready=false;loaded=false;user=null;profile=null;units=[];queue=[];memory=new Map();view=new Map();remote=new Map();$('appFrame').removeAttribute('src');$('appFrame').hidden=true;$('workspace').hidden=true;$('login').hidden=false;$('orderRows').replaceChildren();$('auditRows').replaceChildren();clearTimeout(timer);}
window.GHCloud={ready:false,admin:false,unitList:[],keys:()=>[...memory.keys()],get:key=>memory.get(key)??null,set:storageSet,dirty:()=>frameDirty=true,report};
$('loginForm').onsubmit=async e=>{e.preventDefault();$('enter').disabled=true;$('loginError').textContent='';try{const {data,error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('password').value='';if(error)throw error;await initialize(data.user);}catch(err){$('loginError').textContent=err.message||'Não foi possível entrar.';}finally{$('enter').disabled=false;}};
$('logout').onclick=async()=>{if(queue.length&&!confirm('Há alterações pendentes preservadas neste navegador para esta conta. Sair mesmo assim?'))return;if(flushing){notice('Aguarde a operação em andamento antes de sair.');return;}clearAccount();await client.auth.signOut({scope:'local'});};
$('refresh').onclick=async()=>{if(queue.length){notice('Sincronize ou resolva as pendências antes de atualizar.');return;}if(frameDirty&&!confirm('Atualizar a área de trabalho? Campos ainda não salvos serão descartados.'))return;await load(true);};
$('retry').onclick=async()=>{queue.forEach(x=>x.error=null);persist();connectionError='';await flush();};
$('backup').onclick=async()=>{
 const snapshot={app:'Guedes Hub',format:'backup-online-v1',version:'5.1',usuario:user.id,gerado_em:new Date().toISOString(),data:Object.fromEntries(memory),pendencias:clone(queue),pendencias_outras_abas:otherQueues().map(x=>x.data),servidor:Object.fromEntries(remote)};
 try{if(navigator.onLine){snapshot.auditoria={pedidos:await all('gh_pedidos_historico'),operacao:await all('gh_alteracoes')};}}catch(e){snapshot.aviso='Auditoria não incluída: '+e.message;}
 download('guedes-hub-backup-online-'+new Date().toISOString().slice(0,10)+'.json',snapshot);
};
$('recover').onclick=async()=>{
 if(!confirm('Feche outras abas do Guedes Hub antes de recuperar. Deseja incorporar as pendências preservadas de outras abas?'))return;
 const others=otherQueues();let skipped=0;
 for(const other of others){const remain=[];for(const op of other.data){if(queue.some(x=>x.id===op.id)){remain.push(op);skipped++;}else queue.push({...op,rev:++revision,error:null});}
  persist();if(localStorage.getItem(other.key)===other.text)localStorage.setItem(other.key,JSON.stringify(remain));
 }
 status();await flush();notice(skipped?skipped+' pendência(s) com identificação já presente foram preservadas na outra fila. Exporte antes de resolver.':'Pendências recuperadas. Confira a confirmação do banco.');
};
$('restore').onclick=()=>$('backupFile').click();
$('backupFile').onchange=async()=>{
 const file=$('backupFile').files?.[0];$('backupFile').value='';if(!file)return;
 try{
  if(file.size>30*1024*1024)throw Error('Backup acima de 30 MB.');
  const wrapper=JSON.parse(await file.text()),payload=wrapper.payload||wrapper;
  if(payload.app!=='Guedes Hub'||!payload.data||typeof payload.data!=='object'||Array.isArray(payload.data))throw Error('Formato de backup não reconhecido. Use o backup completo do aplicativo.');
  if(payload.usuario&&payload.usuario!==user.id&&!admin())throw Error('Este backup pertence a outra conta.');
  if(wrapper.payload){
   if(!wrapper.check)throw Error('Backup sem verificação de integridade.');
   const bytes=new TextEncoder().encode(JSON.stringify(payload));let check;
   if(wrapper.check.algorithm==='SHA-256'){const hash=await crypto.subtle.digest('SHA-256',bytes);check=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');}
   else if(wrapper.check.algorithm==='CRC32'){let c=0xffffffff;for(const x of bytes){c^=x;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}check=((c^0xffffffff)>>>0).toString(16).padStart(8,'0');}
   else throw Error('Verificação de integridade não suportada.');
   if(check!==wrapper.check.value)throw Error('Falha de integridade do backup.');
  }
  if(!confirm('Importar este backup? Registros existentes com dados diferentes serão preservados. Configurações já existentes não serão sobrescritas.'))return;
  let imported=0;const skipped=[];
  for(const [key,value] of Object.entries(payload.data)){
   try{
    if(typeof value!=='string')throw Error('Valor inválido');
    if(records.has(key)){
     const old=parseArray(value),current=parseArray(memory.get(key));
     for(const r of old){const existing=current.find(x=>x.id===r.id);if(existing&&!same(existing,r))skipped.push(key+': registro '+r.id+' já existe com conteúdo diferente');}
     const add=old.filter(r=>!current.some(x=>x.id===r.id));if(add.length){storageSet(key,JSON.stringify([...current,...add]));imported+=add.length;}
    }else if(!memory.has(key)){storageSet(key,value);imported++;}else if(memory.get(key)!==value)skipped.push(key+': configuração existente preservada');
   }catch(e){skipped.push(key+': '+e.message);}
  }
  await flush();notice(imported+' item(ns) encaminhado(s) à sincronização. '+(skipped.length?'Itens não importados: '+skipped.join('; '):'Use Atualizar dados para carregar na área de trabalho.'));
 }catch(e){report('Não foi possível importar: '+e.message);}
};
$('importLocal').onclick=importLocal;$('loadAudit').onclick=()=>audit();
window.addEventListener('online',()=>{connectionError='';queue.forEach(x=>{if(x.error&&!/Conflito|autorizad/i.test(x.error))x.error=null;});persistIfUser();flush();});
function persistIfUser(){if(user)persist();}
window.addEventListener('offline',()=>{if(user)report('Sem conexão: alterações ficam pendentes neste aparelho. Não limpe os dados do navegador.');});
window.addEventListener('beforeunload',e=>{if(queue.length||frameDirty){e.preventDefault();e.returnValue='';}});
client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT')clearAccount();else if(session&&user&&session.user.id!==user.id)clearAccount();});
setInterval(()=>{if(loaded&&document.visibilityState==='visible'){flush();}},15000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&loaded)flush();});
client.auth.getUser().then(({data})=>{if(data?.user)initialize(data.user);}).catch(()=>{});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
