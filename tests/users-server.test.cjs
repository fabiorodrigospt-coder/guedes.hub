const assert=require('node:assert/strict');
(async()=>{
 const {handle}=await import('../supabase/functions/gh-usuarios/handler.js');
 const env={SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-only-test-key'};
 const actor='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222';
 let calls=[],admin=true,configOK=true;
 const mock=async(url,options)=>{calls.push({url,options});let data={},status=200;
  if(url.endsWith('/auth/v1/user'))data={id:actor};
  else if(url.includes('/gh_perfis?'))data=[{perfil:url.includes(actor)&&admin?'administrador':'unidade',ativo:true,revisao_acesso:1}];
  else if(url.endsWith('/admin/users')){data={id:target};status=201;}
  else if(url.includes('gh_configurar_usuario')){data=configOK?{}:{error:'failure'};status=configOK?200:400;}
  else if(url.includes('gh_listar_usuarios'))data=[];
  return new Response(JSON.stringify(data),{status});
 };
 const send=(b,auth=true,origin='https://fabiorodrigospt-coder.github.io')=>handle(new Request('https://test.invalid/functions/v1/gh-usuarios',{method:'POST',headers:{Origin:origin,...(auth?{Authorization:'Bearer user-token'}:{}),'Content-Type':'application/json'},body:JSON.stringify(b)}),env,mock);
 const payload={action:'criar',nome:'Teste',email:'unit@example.test',senha:'test-only-password-12',unidade_codigo:'G1',ativo:true,acessos:[{modulo:'pedidos',leitura:'proprios',edicao:'proprios',criar:true,unidades:[]}]};
 assert.equal((await send(payload,false)).status,401);assert.equal(calls.length,0);
 assert.equal((await send(payload,true,'https://evil.invalid')).status,403);assert.equal(calls.length,0);
 admin=false;assert.equal((await send(payload)).status,403);assert.equal(calls.some(x=>x.url.endsWith('/admin/users')),false);
 admin=true;calls=[];let r=await send(payload);assert.equal(r.status,201);assert(!JSON.stringify(await r.json()).includes(payload.senha));
 assert(calls.find(x=>x.url.includes('gh_configurar_usuario')).options.body.includes(actor));
 calls=[];configOK=false;assert.equal((await send(payload)).status,409);assert(calls.some(x=>x.options.method==='DELETE'&&x.url.endsWith(target)));
 configOK=true;calls=[];assert.equal((await send({...payload,senha:'short'})).status,400);assert(!calls.some(x=>x.url.endsWith('/admin/users')));
 calls=[];assert.equal((await send({...payload,action:'editar',usuario_id:actor,revisao_acesso:1})).status,400);
 calls=[];r=await send({...payload,login_nome:'GuedesG2',email:'',senha:'123456'});assert.equal(r.status,201);assert(JSON.parse(calls.find(x=>x.url.endsWith('/admin/users')).options.body).email.endsWith('@login.guedeshub.invalid'));
 calls=[];r=await send({...payload,action:'editar',usuario_id:target,revisao_acesso:1,login_nome:'GuedesG4',email:'real@example.test',senha:'123456'});assert.equal(r.status,200);assert(calls.some(x=>x.options.method==='PUT'&&JSON.parse(x.options.body).email==='real@example.test'));
 calls=[];r=await send({action:'excluir',usuario_id:target,revisao_acesso:1});assert.equal(r.status,200);assert(calls.some(x=>x.url.includes('gh_excluir_usuario')));assert(!calls.some(x=>x.options.method==='DELETE'));
 calls=[];r=await send({action:'listar'});assert.equal(r.status,200);assert.equal((await r.json()).usuarios.length,0);
 console.log('PASS: user manager endpoint, anonymous/non-admin/origin denial, create, password exclusion, failed provisioning cleanup, short-password denial, protected admin and listing.');
})().catch(e=>{console.error(e);process.exit(1)});
