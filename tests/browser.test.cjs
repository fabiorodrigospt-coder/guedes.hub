const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const server=require('node:http').createServer((req,res)=>{const file=path.join(process.cwd(),new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);try{const body=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(body);}catch{res.writeHead(404);res.end('Not found');}});

const ids={admin:'11111111-1111-4111-8111-111111111111',unit:'22222222-2222-4222-8222-222222222222',staff:'33333333-3333-4333-8333-333333333333'};
const email={admin:'admin@example.test',unit:'unit@example.test',staff:'staff@example.test'};
const units=['G1','G2','G4','G5','G7','S1'].map((codigo,i)=>({codigo,nome:['Tradicional','Rooftop','Progresso','Oliveiras','Gaia','Stretto'][i]}));
const db={gh_pedidos:[],gh_operacao_central:[],gh_documentos:[],gh_alteracoes:[],gh_pedidos_historico:[],gh_acessos:[{usuario_id:ids.staff,modulo:'producao',leitura:'proprios',edicao:'proprios',criar:true,unidades:[]},{usuario_id:ids.staff,modulo:'salgados',leitura:'proprios',edicao:'proprios',criar:true,unidades:[]}]};
const profiles={admin:{usuario_id:ids.admin,nome:'Fabio',perfil:'administrador',unidade_codigo:null,ativo:true,revisao_acesso:1,acesso_configurado:false,codigo_relatorio:1},unit:{usuario_id:ids.unit,nome:'Teste G1',perfil:'unidade',unidade_codigo:'G1',ativo:true,revisao_acesso:1,acesso_configurado:false,codigo_relatorio:2},staff:{usuario_id:ids.staff,nome:'Operador',perfil:'colaborador',unidade_codigo:null,ativo:true,revisao_acesso:1,acesso_configurado:true,codigo_relatorio:3}};
const managed=Object.entries(profiles).map(([who,p])=>({...p,email:email[who],acessos:db.gh_acessos.filter(a=>a.usuario_id===p.usuario_id)}));let lastUserRequest;
let writes=0;let dropNextWrite=false;
function jwt(who){const b=s=>Buffer.from(JSON.stringify(s)).toString('base64url');return b({alg:'HS256',typ:'JWT'})+'.'+b({sub:ids[who],role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.test';}
const users=Object.fromEntries(Object.entries(ids).map(([k,id])=>[k,{id,email:email[k],aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}]));
function identify(req){try{const payload=JSON.parse(Buffer.from((req.headers()['authorization']||'').replace('Bearer ','').split('.')[1],'base64url').toString());return Object.keys(ids).find(k=>ids[k]===payload.sub)||null;}catch{return null;}}
function visible(table,rows,who){if(who==='admin')return rows;if(!who)return [];
 if(table==='gh_acessos')return rows.filter(r=>r.usuario_id===ids[who]);
 if(table==='gh_operacao_central')return rows.filter(r=>r.criado_por===ids[who]&&db.gh_acessos.some(a=>a.usuario_id===ids[who]&&a.modulo===r.modulo));
 if(table==='gh_pedidos')return rows.filter(r=>r.criado_por===ids[who]&&r.unidade_codigo===profiles[who].unidade_codigo);
 if(table==='gh_documentos')return rows.filter(r=>r.escopo==='usuario:'+ids[who]||r.escopo==='G1'&&r.criado_por===ids[who]||r.escopo==='central'&&r.chave==='guedes-hub-catalogo-local-v1');
 if(table==='gh_pedidos_historico')return rows.filter(r=>r.unidade_codigo==='G1');
 if(table==='gh_alteracoes')return rows.filter(r=>r.escopo==='G1');return [];
}
async function route(route){const req=route.request(),u=new URL(req.url()),method=req.method();const who=identify(req);let status=200,data;
 const json=(d,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(d)});
 if(u.pathname==='/auth/v1/token'){const body=req.postDataJSON();const name=Object.keys(email).find(k=>email[k]===body.email);if(!name||body.password!=='test-password')return json({msg:'Invalid login credentials'},400);return json({access_token:jwt(name),refresh_token:'refresh-'+name,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:users[name]});}
 if(u.pathname==='/auth/v1/user')return who?json(users[who]):json({msg:'No session'},401);
 if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204});
 if(u.pathname==='/functions/v1/gh-usuarios'){
  if(who!=='admin')return json({error:'Administrador necessário'},403);
  const b=req.postDataJSON();if(b.action==='listar')return json({usuarios:managed});lastUserRequest=b;
  if(b.action==='criar'){managed.push({usuario_id:crypto.randomUUID(),nome:b.nome,email:b.email,unidade_codigo:b.unidade_codigo,perfil:'unidade',ativo:b.ativo,acesso_configurado:true,revisao_acesso:1,acessos:b.acessos});return json({message:'Usuário criado com os acessos definidos.'},201)}
  const target=managed.find(x=>x.usuario_id===b.usuario_id);Object.assign(target,{nome:b.nome,ativo:b.ativo,acessos:b.acessos,revisao_acesso:target.revisao_acesso+1});return json({message:'Cadastro e permissões atualizados.'});
 }
 const table=u.pathname.split('/').pop();if(!who)return json({message:'Unauthorized'},401);
 if(table==='gh_perfis')data=[profiles[who]];else if(table==='gh_unidades')data=who==='admin'?units:units.filter(u=>u.codigo===profiles[who].unidade_codigo);else data=visible(table,db[table]||[],who);
 const matches=r=>[...u.searchParams].filter(([k])=>!['select','order','limit','offset'].includes(k)).every(([k,v])=>v.startsWith('eq.')?String(r[k])===v.slice(3):true);
 if(method==='GET'){data=data.filter(matches);if(req.headers()['accept']?.includes('vnd.pgrst.object')){if(!data.length)return json({code:'PGRST116',message:'No rows'},406);data=data[0];}return json(data);}
 const raw=req.postDataJSON(),body=Array.isArray(raw)?raw[0]:raw;
 if(method==='POST'){
  if(table==='gh_operacao_central'&&who!=='admin'&&!db.gh_acessos.some(a=>a.usuario_id===ids[who]&&a.modulo===body.modulo&&a.criar))return json({code:'42501',message:'Denied'},403);
  if(table==='gh_pedidos'&&who!=='admin'&&body.unidade_codigo!=='G1')return json({code:'42501',message:'Denied'},403);
  const duplicate=(db[table]||[]).find(r=>table==='gh_documentos'?r.escopo===body.escopo&&r.chave===body.chave:r.id===body.id);if(duplicate)return json({code:'23505',message:'Duplicate'},409);
  const row={...body,id:body.id||crypto.randomUUID(),versao:1,criado_por:body.criado_por||ids[who],criado_em:new Date().toISOString(),atualizado_em:new Date().toISOString()};if(table==='gh_pedidos'){row.status='rascunho';row.enviado_em=null;}db[table].push(row);writes++;if(dropNextWrite){dropNextWrite=false;return route.abort('connectionreset');}return json([row],201);
 }
 if(method==='PATCH'){
  const filtered=data.filter(matches).filter(r=>table!=='gh_pedidos'||who==='admin'||r.status==='rascunho');
  for(const r of filtered){Object.assign(r,body);r.versao++;r.atualizado_em=new Date().toISOString();if(r.status==='enviado'&&!r.enviado_em)r.enviado_em=new Date().toISOString();writes++;}return json(filtered);
 }
 return json({message:'Unexpected route '+method+' '+u.pathname},400);
}
async function context(browser,who){const ctx=await browser.newContext({serviceWorkers:'block',acceptDownloads:true,viewport:{width:1280,height:900}});await ctx.route('https://opixtuuscvdwmpkcbhzp.supabase.co/**',route);const page=await ctx.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8765/');await page.locator('#email').fill(email[who]);await page.locator('#password').fill('test-password');await page.locator('#enter').click();await page.locator('#appFrame').waitFor({state:'visible'});await page.frameLocator('#appFrame').locator('#pgApp').waitFor({state:'attached'});await page.waitForTimeout(400);return {ctx,page,errors};}
async function settled(page){try{await page.waitForFunction(()=>document.querySelector('#syncStatus').textContent.startsWith('Banco atualizado'),null,{timeout:12000});}catch(e){console.error('SYNC DEBUG',await page.evaluate(()=>({status:document.querySelector('#syncStatus').textContent,pending:document.querySelector('#pendingList').textContent,notice:document.querySelector('#notice').textContent,queue:Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.includes('pendentes')))})));throw e;}}
(async()=>{await new Promise(r=>server.listen(8765,'127.0.0.1',r));const provider=process.env.GH_TEST_CHROMIUM_MODULE?require(process.env.GH_TEST_CHROMIUM_MODULE):null;const browser=await chromium.launch(provider?{headless:true,executablePath:await provider.executablePath(),args:provider.args.filter(a=>a!=='--single-process')}:{headless:true});try{
 const a=await context(browser,'admin');assert.deepEqual(a.errors,[],'workspace JS errors');assert.equal(await a.page.frameLocator('#appFrame').locator('#producao').count(),1);
 assert.equal(await a.page.locator('#identity').textContent(),'Fabio · Administrador');
 assert.equal(await a.page.locator('#refresh').isVisible(),false);
 assert.equal(await a.page.locator('#appNav [data-target="ajustes"]').count(),0);
 assert.equal(await a.page.locator('footer').textContent(),'Casa Guedes · acesso controlado por usuário');
 await a.page.getByRole('button',{name:'Ajustes',exact:true}).click();
 await a.page.locator('#settingsDialog').waitFor({state:'visible'});
 assert.equal(await a.page.locator('#refresh').isVisible(),true);
 assert.equal(await a.page.locator('#backup').isVisible(),true);
 assert.equal(await a.page.locator('#operationalSettings').isVisible(),true);
 await a.page.locator('#operationalSettings').click();
 await a.page.frameLocator('#appFrame').locator('#ajustes').waitFor({state:'visible'});
 await a.page.getByRole('button',{name:'Ajustes',exact:true}).click();
 await a.page.locator('#settingsClose').click();

 // Actual production form, unchanged workflow.
 const f=a.page.frameLocator('#appFrame');
 await a.page.locator('#appNav [data-target="gestao"]').click();
 await f.locator('#usrName').fill('Nova pessoa');await f.locator('#usrEmail').fill('new@example.test');await f.locator('#usrPassword').fill('test-only-password-12');await f.locator('#usrUnit').selectOption('G2');
 await f.locator('[data-module="pedidos"] [data-enabled]').check();await f.locator('#usrSave').click();await f.locator('#usrStatus').filter({hasText:'Usuário criado'}).waitFor();
 assert.equal(lastUserRequest.acessos[0].leitura,'proprios');assert.equal(lastUserRequest.acessos[0].edicao,'proprios');assert.equal(lastUserRequest.unidade_codigo,'G2');assert.equal(await f.locator('#usrPassword').inputValue(),'');
 assert.equal(await a.page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('test-only-password-12')),false);
 await f.locator('#usrList .usrRecord').filter({hasText:'Nova pessoa'}).getByRole('button',{name:'Editar acessos'}).click();
 await f.locator('[data-module="pedidos"] [data-read]').selectOption('selecionadas');await f.locator('[data-module="pedidos"] [data-edit]').selectOption('nenhum');await f.locator('[data-module="pedidos"] .usrHouses input[value="G4"]').check();await f.locator('#usrSave').click();await f.locator('#usrStatus').filter({hasText:'Cadastro e permissões atualizados'}).waitFor();
 assert.equal(lastUserRequest.action,'editar');assert.equal(lastUserRequest.acessos[0].edicao,'nenhum');assert.deepEqual(lastUserRequest.acessos[0].unidades,['G4']);assert.equal('senha' in lastUserRequest,false);
 // Reader must carry all categories through preview, save, reopen and cloud persistence.
 const {synthetic}=require('./reader.test.cjs');
 await a.page.locator('#appNav [data-target="importar"]').click();
 await f.locator('#source').fill(process.env.GH_ORIGINAL_LIST?fs.readFileSync(process.env.GH_ORIGINAL_LIST,'utf8'):synthetic);
 await f.locator('#parse').click();await f.locator('#mode').selectOption('total');
 assert.equal(await f.locator('#categories input:checked').count(),8);
 assert.equal(await f.locator('.preview-total-line').count(),25);
 await f.locator('#save').click();await settled(a.page);
 const saved=JSON.parse(db.gh_documentos.find(x=>x.chave==='guedes-hub-1.1-history').valor);
 assert.equal(new Set(saved[0].entries.filter(e=>e.qty>0).map(e=>e.name+'|'+e.measure)).size,25);
 await a.page.locator('#appNav [data-target="historico"]').click();await f.locator('[data-open]').first().click();
 assert.equal(await f.locator('.preview-total-line').count(),25);
await a.page.locator('#appNav [data-target="producao"]').click();await f.locator('#prodResponsible').fill('Fabio teste');await f.locator('#prodSave').click();await settled(a.page);assert.equal(db.gh_operacao_central.length,1);assert.equal(db.gh_operacao_central[0].modulo,'producao');
 // Full salgados record and a configuration are routed to their respective tables.
 await a.page.evaluate(()=>{GHCloud.set('guedes-salgados-v1',JSON.stringify([{id:'sal-teste',date:'2026-10-28',leader:'Fabio',items:[],notes:'Teste',fields:{},clean:[],layout:'visual'}]));GHCloud.set('gh43-pedido-modelos-v1',JSON.stringify([{id:'m1',name:'Modelo',unit:'G1',values:{}}]));});await settled(a.page);assert.equal(db.gh_operacao_central.length,2);assert.equal(db.gh_documentos.filter(x=>x.chave==='gh43-pedido-modelos-v1').length,1);
 // Legacy data import preserves originals and puts missing records into the database.
 await a.page.evaluate(()=>localStorage.setItem('guedes-hub-production-v1',JSON.stringify([{id:'prod-legado',date:'2026-10-27',number:'055/2026',responsible:'Legado',production:[],orders:[],cleaning:true,notes:'preservado',layout:'visual'}])));
 await a.page.getByRole('button',{name:'Ajustes',exact:true}).click();a.page.once('dialog',d=>d.accept());await a.page.locator('#importLocal').click();await settled(a.page);assert.equal(db.gh_operacao_central.length,3);assert.match(await a.page.evaluate(()=>localStorage.getItem('guedes-hub-production-v1')),/prod-legado/);
 // A lost network response must not create duplicate records on retry.
 dropNextWrite=true;await a.page.evaluate(()=>{const rows=JSON.parse(GHCloud.get('guedes-salgados-v1'));rows.push({id:'sal-resposta-perdida',date:'2026-10-28',leader:'Fabio',items:[],notes:'',fields:{},clean:[],layout:'visual'});GHCloud.set('guedes-salgados-v1',JSON.stringify(rows));});
 await a.page.waitForFunction(()=>document.querySelector('#pendingList').textContent.includes('Failed')||document.querySelector('#pendingList').textContent.includes('fetch'));
 await a.page.locator('#retry').click();await settled(a.page);assert.equal(db.gh_operacao_central.filter(r=>r.dados.id==='sal-resposta-perdida').length,1);await a.page.locator('#notice').waitFor({state:'hidden'});
 // Second device receives both modules and configuration.
 const b=await context(browser,'admin');const mirror=await b.page.evaluate(()=>({sal:JSON.parse(GHCloud.get('guedes-salgados-v1')),prod:JSON.parse(GHCloud.get('guedes-hub-production-v1')),models:JSON.parse(GHCloud.get('gh43-pedido-modelos-v1'))}));assert.equal(mirror.sal.length,2);assert.equal(mirror.prod.length,2);assert.equal(mirror.models[0].name,'Modelo');
 // Optimistic concurrency: first editor wins; stale editor stays pending.
 await a.page.evaluate(()=>GHCloud.set('gh43-pedido-modelos-v1','[{"id":"m1","name":"A"}]'));await settled(a.page);
 await b.page.evaluate(()=>GHCloud.set('gh43-pedido-modelos-v1','[{"id":"m1","name":"B"}]'));await b.page.waitForFunction(()=>document.querySelector('#pendingList').textContent.includes('Conflito'));assert.match(db.gh_documentos.find(x=>x.chave==='gh43-pedido-modelos-v1').valor,/"A"/);
 // Unit role receives no production/salgados data; cannot stage an admin module.
 const u=await context(browser,'unit');
 assert.equal(await u.page.locator('#identity').textContent(),'Teste G1 · G1');
 assert.equal(await u.page.locator('#restore').isVisible(),false);
 await u.page.getByRole('button',{name:'Ajustes',exact:true}).click();
 assert.equal(await u.page.locator('#restore').isVisible(),true);
 assert.equal(await u.page.locator('#importLocal').isVisible(),false);
 assert.equal(await u.page.locator('#operationalSettings').isVisible(),false);
 await u.page.locator('#settingsDialog').press('Escape');
assert.deepEqual(u.errors,[]);assert.equal(await u.page.evaluate(()=>JSON.parse(GHCloud.get('guedes-salgados-v1')).length),0);assert.equal(await u.page.frameLocator('#appFrame').locator('[data-tab="producao"]').isVisible(),false);
 assert.equal(await u.page.evaluate(()=>{try{GHCloud.set('guedes-salgados-v1','[{"id":"x","date":"2026-10-28"}]');return false;}catch{return true;}}),true);
 const orderId=crypto.randomUUID();await u.page.evaluate(id=>GHCloud.set('gh34-pedido-guiado-historico-v1',JSON.stringify([{id,unit:'G1',date:'2026-10-28',values:{}}])),orderId);await settled(u.page);assert.equal(db.gh_pedidos.length,1);
 // Submission freezes edits for unit (server row and client state).
 await u.page.getByRole('button',{name:'Ajustes',exact:true}).click();await u.page.locator('#onlineOrders > summary').click();u.page.once('dialog',d=>d.accept());await u.page.getByRole('button',{name:'Enviar no sistema',exact:true}).click();await settled(u.page);assert.equal(db.gh_pedidos[0].status,'enviado');assert.equal(await u.page.evaluate(()=>{const a=JSON.parse(GHCloud.get('gh34-pedido-guiado-historico-v1'));a[0].values={x:1};try{GHCloud.set('gh34-pedido-guiado-historico-v1',JSON.stringify(a));return false;}catch{return true;}}),true);
 await u.page.locator('#settingsClose').click();
 // Offline queue is preserved and flushed on reconnection without claiming saved online.
 await u.ctx.setOffline(true);await u.page.evaluate(()=>GHCloud.set('gh43-pedido-modelos-v1','[{"id":"offline","name":"Offline"}]'));assert.match(await u.page.locator('#syncStatus').textContent(),/pendente|Sem conexão/);assert.equal(db.gh_documentos.filter(x=>x.escopo==='usuario:'+ids.unit).length,0);await u.ctx.setOffline(false);await settled(u.page);assert.equal(db.gh_documentos.find(x=>x.escopo==='usuario:'+ids.unit).valor,'[{"id":"offline","name":"Offline"}]');
 // Logout clears all data visible to next account.
 await u.page.locator('#logout').click();await u.page.locator('#login').waitFor({state:'visible'});assert.equal(await u.page.evaluate(()=>GHCloud.ready),false);assert.equal(await u.page.locator('#appFrame').isVisible(),false);
 const staff=await context(browser,'staff');const sf=staff.page.frameLocator('#appFrame');
 assert.equal(await staff.page.locator('#appNav [data-target="producao"]').isVisible(),true);assert.equal(await staff.page.locator('#appNav [data-target="guiado"]').isVisible(),false);assert.equal(await staff.page.locator('#appNav [data-target="gestao"]').isVisible(),false);
 assert.equal(await staff.page.evaluate(()=>JSON.parse(GHCloud.get('guedes-hub-production-v1')).length),0);
 await sf.locator('#prodResponsible').fill('Operador');await sf.locator('#prodSave').click();await settled(staff.page);
 assert.equal(db.gh_operacao_central.filter(r=>r.criado_por===ids.staff).length,1);assert.match(db.gh_operacao_central.find(r=>r.criado_por===ids.staff).dados.number,/-P3$/);
 await staff.page.locator('#appNav [data-target="salgados"]').click();await sf.locator('#salLeader').fill('Operador');await sf.locator('#salSave').click();await settled(staff.page);
 assert.equal(db.gh_operacao_central.filter(r=>r.criado_por===ids.staff).length,2);
 assert.equal(await staff.page.evaluate(async()=>{try{await GHCloud.manageUsers({action:'listar'});return false}catch{return true}}),true);
 profiles.staff.revisao_acesso++;profiles.staff.ativo=false;
 await staff.page.getByRole('button',{name:'Ajustes',exact:true}).click();staff.page.once('dialog',d=>d.accept());await staff.page.locator('#refresh').click();
 await staff.page.waitForFunction(()=>!GHCloud.ready);assert.equal(await staff.page.locator('#appFrame').isVisible(),false);
 assert.deepEqual(staff.errors,[]);
 assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);assert.deepEqual(u.errors,[]);
 await a.page.locator('#appNav [data-target="gestao"]').click();await f.locator('#usrNew').click();await f.locator('[data-module="producao"] [data-enabled]').check();await f.locator('[data-module="salgados"] [data-enabled]').check();await f.locator('#userManager').screenshot({path:'/tmp/guedes55-users-desktop.png'});await a.page.setViewportSize({width:390,height:844});await f.locator('#userManager').screenshot({path:'/tmp/guedes55-users-mobile.png'});await a.page.setViewportSize({width:1280,height:900});
 await a.page.evaluate(()=>window.scrollTo(0,0));await a.page.screenshot({path:'/tmp/guedes-admin.png',fullPage:false});await a.page.setViewportSize({width:390,height:844});await a.page.evaluate(()=>window.scrollTo(0,0));assert(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await a.page.screenshot({path:'/tmp/guedes-mobile.png'});await a.page.getByRole('button',{name:'Ajustes',exact:true}).click();await a.page.screenshot({path:'/tmp/guedes-mobile-settings.png'});await a.page.locator('#settingsClose').click();console.log('PASS: original production workflow, salgados, models, second device, stale-version conflict, unit isolation, submission lock, offline queue, logout. Writes:',writes);
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exit(1);});
