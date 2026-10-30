const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const server=require('node:http').createServer((req,res)=>{const file=path.join(process.cwd(),new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);try{const body=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(body);}catch{res.writeHead(404);res.end('Not found');}});

const ids={admin:'11111111-1111-4111-8111-111111111111',unit:'22222222-2222-4222-8222-222222222222',staff:'33333333-3333-4333-8333-333333333333'};
const email={admin:'admin@example.test',unit:'unit@example.test',staff:'staff@example.test'};
const units=['G1','G2','G4','G5','G7','S1'].map((codigo,i)=>({codigo,nome:['Tradicional','Rooftop','Progresso','Oliveiras','Gaia','Stretto'][i]}));
const db={gh_pedidos:[],gh_operacao_central:[],gh_documentos:[],gh_alteracoes:[],gh_pedidos_historico:[],gh_acessos:[{usuario_id:ids.staff,modulo:'producao',leitura:'proprios',edicao:'proprios',criar:true,unidades:[]},{usuario_id:ids.staff,modulo:'salgados',leitura:'proprios',edicao:'proprios',criar:true,unidades:[]}]};
const profiles={admin:{usuario_id:ids.admin,nome:'Fabio',perfil:'administrador',unidade_codigo:null,ativo:true,revisao_acesso:1,acesso_configurado:false,codigo_relatorio:1},unit:{usuario_id:ids.unit,nome:'Teste G1',login_nome:'GuedesG1',perfil:'unidade',unidade_codigo:'G1',ativo:true,revisao_acesso:1,acesso_configurado:false,codigo_relatorio:2},staff:{usuario_id:ids.staff,nome:'Operador',perfil:'colaborador',unidade_codigo:null,ativo:true,revisao_acesso:1,acesso_configurado:true,codigo_relatorio:3}};

// Homologacao isolada: seis identidades ficticias, sem acesso ao Supabase de producao.
for(let i=0;i<units.length;i++){
 const code=units[i].codigo,who='house'+code;
 ids[who]='44444444-4444-4444-8444-'+String(i+1).padStart(12,'0');
 email[who]='house-'+code.toLowerCase()+'@example.test';
 profiles[who]={usuario_id:ids[who],nome:'Teste '+code,login_nome:'Guedes'+code,perfil:'unidade',unidade_codigo:code,ativo:true,revisao_acesso:1,acesso_configurado:false,codigo_relatorio:10+i};
}
const managed=Object.entries(profiles).map(([who,p])=>({...p,email:email[who],acessos:db.gh_acessos.filter(a=>a.usuario_id===p.usuario_id)}));let lastUserRequest;
let writes=0;let dropNextWrite=false;
function jwt(who){const b=s=>Buffer.from(JSON.stringify(s)).toString('base64url');return b({alg:'HS256',typ:'JWT'})+'.'+b({sub:ids[who],role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.test';}
const users=Object.fromEntries(Object.entries(ids).map(([k,id])=>[k,{id,email:email[k],aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}]));
function identify(req){try{const payload=JSON.parse(Buffer.from((req.headers()['authorization']||'').replace('Bearer ','').split('.')[1],'base64url').toString());return Object.keys(ids).find(k=>ids[k]===payload.sub)||null;}catch{return null;}}
function visible(table,rows,who){if(who==='admin')return rows;if(!who)return [];
 if(table==='gh_acessos')return rows.filter(r=>r.usuario_id===ids[who]);
 if(table==='gh_operacao_central')return rows.filter(r=>r.criado_por===ids[who]&&db.gh_acessos.some(a=>a.usuario_id===ids[who]&&a.modulo===r.modulo));
 if(table==='gh_pedidos')return rows.filter(r=>r.criado_por===ids[who]&&r.unidade_codigo===profiles[who].unidade_codigo);
 if(table==='gh_documentos')return rows.filter(r=>r.escopo==='usuario:'+ids[who]||r.escopo===profiles[who].unidade_codigo&&r.criado_por===ids[who]||r.escopo==='central'&&r.chave==='guedes-hub-catalogo-local-v1');
 if(table==='gh_pedidos_historico')return rows.filter(r=>r.unidade_codigo===profiles[who].unidade_codigo);
 if(table==='gh_alteracoes')return rows.filter(r=>r.escopo===profiles[who].unidade_codigo);return [];
}
async function route(route){const req=route.request(),u=new URL(req.url()),method=req.method();const who=identify(req);let status=200,data;
 const json=(d,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(d)});
 if(u.pathname==='/auth/v1/token'){const body=req.postDataJSON();const name=Object.keys(email).find(k=>email[k]===body.email);if(!name||body.password!=='test-password')return json({msg:'Invalid login credentials'},400);return json({access_token:jwt(name),refresh_token:'refresh-'+name,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:users[name]});}
 if(u.pathname==='/auth/v1/user')return who?json(users[who]):json({msg:'No session'},401);
 if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204});
 if(u.pathname==='/functions/v1/gh-login'){
  const b=req.postDataJSON();const who=Object.keys(profiles).find(k=>profiles[k].login_nome?.toLowerCase()===b.login.toLowerCase());if(!who||b.senha!=='123456')return json({error:'Usuário ou senha inválidos.'},401);return json({access_token:jwt(who),refresh_token:'refresh-'+who});
 }
 if(u.pathname==='/functions/v1/gh-usuarios'){
  if(who!=='admin')return json({error:'Administrador necessário'},403);
  const b=req.postDataJSON();if(b.action==='listar')return json({usuarios:managed});lastUserRequest=b;
  if(b.action==='criar'){managed.push({usuario_id:crypto.randomUUID(),nome:b.nome,login_nome:b.login_nome,email:b.email,unidade_codigo:b.unidade_codigo,perfil:'unidade',ativo:b.ativo,acesso_configurado:true,revisao_acesso:1,acessos:b.acessos});return json({message:'Usuário criado com os acessos definidos.'},201)}
  const target=managed.find(x=>x.usuario_id===b.usuario_id);if(b.action==='excluir'){Object.assign(target,{excluido:true,ativo:false,revisao_acesso:target.revisao_acesso+1});return json({message:'Usuário excluído. Acesso bloqueado e históricos preservados.'})}Object.assign(target,{excluido:false,login_nome:b.login_nome,nome:b.nome,ativo:b.ativo,acessos:b.acessos,revisao_acesso:target.revisao_acesso+1});return json({message:'Cadastro e permissões atualizados.'});
 }
 const table=u.pathname.split('/').pop();if(!who)return json({message:'Unauthorized'},401);
 if(table==='gh_perfis')data=[profiles[who]];else if(table==='gh_unidades')data=who==='admin'?units:units.filter(u=>u.codigo===profiles[who].unidade_codigo);else data=visible(table,db[table]||[],who);
 const matches=r=>[...u.searchParams].filter(([k])=>!['select','order','limit','offset'].includes(k)).every(([k,v])=>v.startsWith('eq.')?String(r[k])===v.slice(3):true);
 if(method==='GET'){data=data.filter(matches);if(req.headers()['accept']?.includes('vnd.pgrst.object')){if(!data.length)return json({code:'PGRST116',message:'No rows'},406);data=data[0];}return json(data);}
 const raw=req.postDataJSON(),body=Array.isArray(raw)?raw[0]:raw;
 if(method==='POST'){
  if(table==='gh_operacao_central'&&who!=='admin'&&!db.gh_acessos.some(a=>a.usuario_id===ids[who]&&a.modulo===body.modulo&&a.criar))return json({code:'42501',message:'Denied'},403);
  if(table==='gh_pedidos'&&who!=='admin'&&body.unidade_codigo!==profiles[who].unidade_codigo)return json({code:'42501',message:'Denied'},403);
  const duplicate=(db[table]||[]).find(r=>table==='gh_documentos'?r.escopo===body.escopo&&r.chave===body.chave:r.id===body.id);if(duplicate)return json({code:'23505',message:'Duplicate'},409);
  const row={...body,id:body.id||crypto.randomUUID(),versao:1,criado_por:body.criado_por||ids[who],criado_em:new Date().toISOString(),atualizado_em:new Date().toISOString()};if(table==='gh_pedidos'){row.status='rascunho';row.enviado_em=null;}db[table].push(row);writes++;if(dropNextWrite){dropNextWrite=false;return route.abort('connectionreset');}return json([row],201);
 }
 if(method==='PATCH'){
  const filtered=data.filter(matches).filter(r=>table!=='gh_pedidos'||who==='admin'||r.status==='rascunho');
  for(const r of filtered){Object.assign(r,body);r.versao++;r.atualizado_em=new Date().toISOString();if(r.status==='enviado'&&!r.enviado_em)r.enviado_em=new Date().toISOString();writes++;}return json(filtered);
 }
 return json({message:'Unexpected route '+method+' '+u.pathname},400);
}
async function context(browser,who,useAlias=false){const ctx=await browser.newContext({serviceWorkers:'block',acceptDownloads:true,viewport:{width:1280,height:900}});await ctx.route('https://**/*',r=>r.abort());await ctx.route('https://opixtuuscvdwmpkcbhzp.supabase.co/**',route);const page=await ctx.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8876/');await page.locator('#email').fill(useAlias?profiles[who].login_nome:email[who]);await page.locator('#password').fill(useAlias?'123456':'test-password');await page.locator('#enter').click();await page.locator('#appFrame').waitFor({state:'visible'});await page.frameLocator('#appFrame').locator('#pgApp').waitFor({state:'attached'});await page.waitForTimeout(400);return {ctx,page,errors};}
async function settled(page){try{await page.waitForFunction(()=>document.querySelector('#syncStatus').textContent.startsWith('Banco atualizado'),null,{timeout:12000});}catch(e){console.error('SYNC DEBUG',await page.evaluate(()=>({status:document.querySelector('#syncStatus').textContent,pending:document.querySelector('#pendingList').textContent,notice:document.querySelector('#notice').textContent,queue:Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.includes('pendentes')))})));throw e;}}

const HISTORY='gh34-pedido-guiado-historico-v1';
const codes=['G1','G2','G4','G5','G7','S1'];
const diagnostics=[];
async function frame(page){return page.frameLocator('#appFrame');}
async function clickNav(page,tab){await page.locator('#appNav [data-target="'+tab+'"]').click();}
async function newOrder(page,code){
 const f=await frame(page);
 await clickNav(page,'guiado');
 await f.locator('#pgApp [data-unit="'+code+'"]').click();
 await f.locator('#pgApp [data-mode="lista"]').click();
 await f.locator('#pgApp [data-action="start"]').click();
 await f.locator('#pgApp [data-field="pedido"]').first().waitFor({state:'visible'});
 return f;
}
(async()=>{
 await new Promise(r=>server.listen(8876,'127.0.0.1',r));
 const provider=process.env.GH_TEST_CHROMIUM_MODULE?require(process.env.GH_TEST_CHROMIUM_MODULE):null;
 const browser=await chromium.launch(provider?{headless:true,executablePath:await provider.executablePath(),args:provider.args.filter(a=>a!=='--single-process')}:{headless:true});
 const clients={};
 try{
   for(const code of codes){
     const who='house'+code,client=await context(browser,who);
     clients[code]=client;
     assert.equal(await client.page.locator('#identity').textContent(),'Teste '+code+' · '+code);
     const available=await client.page.evaluate(()=>GHCloud.unitList.map(u=>u[0]));
     assert.deepEqual(available,[code],'Apenas a unidade autorizada deve estar disponivel para '+code);
     assert.equal(await client.page.locator('#appNav [data-target="gestao"]').isVisible(),false);
     assert.equal(await client.page.locator('#appNav [data-target="producao"]').isVisible(),false);
     assert.equal(await client.page.locator('#appNav [data-target="salgados"]').isVisible(),false);
     const f=await newOrder(client.page,code);
     const first=f.locator('#pgApp [data-field="pedido"]').first();
     // Varredura de TODOS os campos visiveis de estoque/pedido nesta casa.
     const sweep=await f.locator('#pgApp [data-field]').evaluateAll(els=>{
       const invalid=[];
       for(let i=0;i<els.length;i++){
         const el=els[i],molho=el.dataset.cat==='Francesinha'&&el.dataset.prod==='Molho Francesinha'&&el.dataset.field==='pedido';
         el.value=molho?'1':String((i%7)+1);
         el.dispatchEvent(new Event('input',{bubbles:true}));
         if(!el.validity.valid)invalid.push(el.dataset.cat+'/'+el.dataset.prod+'/'+el.dataset.field);
       }
       return {total:els.length,invalid};
     });
     assert(sweep.total>=10,'Catalogo sem campos suficientes em '+code);
     assert.deepEqual(sweep.invalid,[],'Campos com rejeicao inesperada em '+code);
     await first.fill('texto-invalido');
     assert.equal(await first.evaluate(el=>el.validity.customError),true,'Campo invalido nao sinalizado');
     await first.fill('0');
     assert.equal(await first.evaluate(el=>el.validity.customError),false,'Zero deve ser aceito');
     if(code==='G4'){
       const molho=f.locator('#pgApp [data-cat="Francesinha"][data-prod="Molho Francesinha"][data-field="pedido"]');
       assert.equal(await molho.count(),1);
       await molho.fill('11');
       const seen=[];client.page.on('dialog',async d=>{seen.push(d.message());await d.dismiss()});
       await f.locator('#pgApp [data-action="preview"]').click();
       assert.equal(await f.locator('#pgApp [data-action="history-save"]').count(),0,'Acima de 300 L deve bloquear');
       assert(seen.some(s=>s.includes('300 L')),'Aviso de limite deve aparecer');
       await molho.fill('1');
     }else{
       await first.fill('2');
     }
     await f.locator('#pgApp [data-action="preview"]').click();
     assert.equal(await f.locator('#pgApp [data-action="history-save"]').count(),1,'Conferencia acessivel');
     await f.locator('#pgApp [data-action="history-save"]').click();
     await settled(client.page);
     const owned=db.gh_pedidos.filter(row=>row.criado_por===ids[who]&&row.unidade_codigo===code);
     assert.equal(owned.length,1,'Um pedido isolado para '+code);
     assert.equal(owned[0].status,'rascunho');
     const list=await client.page.evaluate(key=>JSON.parse(GHCloud.get(key)),HISTORY);
     assert.equal(list.length,1,'Historico preservado em '+code);
     assert.equal(list[0].unit,code);
     assert.deepEqual(client.errors,[],'Erros JavaScript em '+code);
     // Impedir que o usuario altere outra unidade mesmo por chamada direta da camada de dados.
     const blocked=await client.page.evaluate((p)=>{
       const rows=JSON.parse(GHCloud.get(p));
       rows.push({...rows[0],id:crypto.randomUUID(),unit:'OUTRA',date:'2026-10-30'});
       try{GHCloud.set(p,JSON.stringify(rows));return false;}catch{return true;}
     },HISTORY);
     assert.equal(blocked,true,'Tentativa de escrever em outra casa bloqueada: '+code);
     diagnostics.push({unidade:code,campos_validados:sweep.total,cenario:'Todos os campos de pedido/estoque, login, historico e isolamento',resultado:'PASSOU'});
     console.log('PASS: '+code+' — '+sweep.total+' campos, invalidos, zero, pedido, historico, isolamento e salvamento simulado.');
   }
   // Uma conta de cada casa nunca pode ler o historico de outra casa.
   for(const code of codes){
     const visible=await clients[code].page.evaluate(key=>JSON.parse(GHCloud.get(key)),HISTORY);
     assert.equal(visible.length,1);
     assert(visible.every(row=>row.unit===code));
   }
   const admin=await context(browser,'admin');
   const full=await admin.page.evaluate(key=>JSON.parse(GHCloud.get(key)),HISTORY);
   assert.equal(full.length,6,'Administrador deve visualizar seis pedidos');
   assert.equal(new Set(full.map(r=>r.unit)).size,6);
   diagnostics.push({cenario:'Administrador visualiza seis unidades, isolamento lateral',resultado:'PASSOU'});
   // Conflito otimista entre dois celulares da mesma unidade.
   const second=await context(browser,'houseG1');
   const original=JSON.parse(await second.page.evaluate(key=>GHCloud.get(key),HISTORY));
   assert.equal(original.length,1);
   const firstUpdate=await clients.G1.page.evaluate(key=>{
     const list=JSON.parse(GHCloud.get(key));
     list[0].values={...list[0].values,TesteHomologacao:{'Item ficticio':{pedido:'3'}}};
     GHCloud.set(key,JSON.stringify(list));
     return list[0].id;
   },HISTORY);
   await settled(clients.G1.page);
   const dbRow=db.gh_pedidos.find(x=>x.criado_por===ids.houseG1);
   assert.deepEqual(dbRow.dados.values.TesteHomologacao['Item ficticio'],{pedido:'3'});
   await second.page.evaluate(({key,records})=>{
     records[0].values={...records[0].values,TesteHomologacao:{'Item ficticio':{pedido:'5'}}};
     GHCloud.set(key,JSON.stringify(records));
   },{key:HISTORY,records:original});
   await second.page.waitForFunction(()=>document.querySelector('#pendingList')?.textContent.includes('Conflito'),null,{timeout:12000});
   assert.equal(db.gh_pedidos.find(x=>x.criado_por===ids.houseG1).dados.values.TesteHomologacao['Item ficticio'].pedido,'3');
   diagnostics.push({cenario:'Dois celulares editam pedido simultaneamente',resultado:'PASSOU — conflito bloqueado'});
   console.log('PASS: conflito entre celulares: alteracao atrasada nao sobrescreveu pedido.');
   // Exclusao logica do usuario, historicos permanecem.
   const affected=managed.find(x=>x.usuario_id===ids.houseG2);
   const before=db.gh_pedidos.find(x=>x.criado_por===ids.houseG2);
   const result=await admin.page.evaluate(async id=>GHCloud.manageUsers({action:'excluir',usuario_id:id}),ids.houseG2);
   assert.match(result.message,/exclu/i);
   assert.equal(affected.excluido,true);
   assert.equal(affected.ativo,false);
   assert.equal(db.gh_pedidos.find(x=>x.criado_por===ids.houseG2),before);
   diagnostics.push({cenario:'Excluir cadastro preservando historicos',resultado:'PASSOU — exclusao logica'});
   console.log('PASS: exclusao logica do cadastro preservou o pedido historico.');
   // O leitor de pedidos e os calculos continuam sendo cobertos por reader.test.cjs.
   // Diagnostico conhecido: clientes veem apenas registros autorizados e nao conseguem
   // garantir sozinhos o limite GLOBAL de 300 L entre casas em varios dispositivos.
   const globalBidons=6*2;
   if(globalBidons>10)diagnostics.push({cenario:'Limite global em pedidos simultaneos de seis casas',resultado:'PENDENTE — requer verificacao transacional central no banco'});
   fs.mkdirSync('auditoria',{recursive:true});
   fs.writeFileSync('auditoria/homologacao.json',JSON.stringify({ambiente:'API simulada; nenhuma gravacao no Supabase real',versao:require('../package.json').version,executado_em:new Date().toISOString(),casos:diagnostics},null,2));
   console.log('ATENCAO: Limite de 300 L entre contas isoladas ainda nao e garantido pelo backend.');
   console.log('PASS: homologacao isolada concluida, seis unidades e concorrencia; relatorio auditoria/homologacao.json');
   for(const [code,client] of Object.entries(clients))await client.ctx.close();
   await admin.ctx.close();await second.ctx.close();
 }finally{await browser.close();server.close();}
})().catch(e=>{
 console.error(e);
 fs.mkdirSync('auditoria',{recursive:true});
 fs.writeFileSync('auditoria/homologacao-falha.txt',String(e?.stack||e));
 server.close();process.exit(1);
});
