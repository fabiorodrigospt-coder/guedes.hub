// All privileged requests stay on the server. Never log request bodies or passwords.
const ORIGINS=new Set(['https://fabiorodrigospt-coder.github.io','https://guedeshub.fabiorodrigospt.workers.dev']);
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
export async function handle(req,env,fetcher=fetch){
 const origin=req.headers.get('origin');const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 if(origin&&ORIGINS.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'});
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!ORIGINS.has(origin))return reply({error:'Origem não autorizada.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Método não permitido.'},405);
 const auth=req.headers.get('authorization');if(!auth?.startsWith('Bearer '))return reply({error:'Entre na sua conta.'},401);
 const url=env.SUPABASE_URL,secret=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return reply({error:'Serviço de cadastro indisponível.'},503);
 const api=async(path,method='GET',body,token=secret)=>{
  const r=await fetcher(url+path,{method,headers:{apikey:secret,Authorization:token.startsWith('Bearer ')?token:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  let data;try{data=await r.json()}catch{data=null}return {ok:r.ok,status:r.status,data};
 };
 try{
  const user=await api('/auth/v1/user','GET',undefined,auth);
  if(!user.ok||!uuid(user.data?.id))return reply({error:'Sessão inválida. Entre novamente.'},401);
  const actor=user.data.id;
  const perfil=await api('/rest/v1/gh_perfis?usuario_id=eq.'+actor+'&select=perfil,ativo');
  if(!perfil.ok||perfil.data?.[0]?.perfil!=='administrador'||perfil.data[0].ativo!==true)return reply({error:'Cadastro exclusivo do administrador.'},403);
  const text=await req.text();if(text.length>12000)return reply({error:'Cadastro excede o tamanho permitido.'},413);
  let b;try{b=JSON.parse(text)}catch{return reply({error:'Cadastro inválido.'},400)}
  if(b.action==='listar'){
   const r=await api('/rest/v1/rpc/gh_listar_usuarios','POST',{ator:actor});
   return r.ok?reply({usuarios:r.data}):reply({error:'Não foi possível carregar os usuários.'},500);
  }
  if(b.action==='excluir'){
   if(!uuid(b.usuario_id)||b.usuario_id===actor||!Number.isSafeInteger(b.revisao_acesso))return reply({error:'Usuário inválido ou protegido.'},400);
   const r=await api('/rest/v1/rpc/gh_excluir_usuario','POST',{ator:actor,alvo:b.usuario_id,revisao_esperada:b.revisao_acesso});
   return r.ok?reply({message:'Usuário excluído. Acesso bloqueado e históricos preservados.'}):reply({error:'Exclusão não concluída. Atualize a lista; administradores estão protegidos.'},409);
  }
  if(!['criar','editar'].includes(b.action))return reply({error:'Ação inválida.'},400);
  const login=b.login_nome?String(b.login_nome).trim():null;
  if(login&&!/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(login))return reply({error:'Use de 3 a 32 caracteres no nome de acesso, começando com uma letra, sem espaços ou acentos.'},400);
  const nome=String(b.nome||login||'').trim(),email=String(b.email||'').trim().toLowerCase(),password=b.senha;
  if(nome.length<2||nome.length>100||!Array.isArray(b.acessos)||b.acessos.length>3||(!b.acessos.length&&b.ativo!==false))return reply({error:'Informe nome e pelo menos um módulo, ou desative a conta.'},400);
  if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.endsWith('@login.guedeshub.invalid')))return reply({error:'Informe um e-mail válido ou deixe em branco.'},400);
  if(b.action==='criar'&&!email&&!login)return reply({error:'Informe o nome de acesso.'},400);
  if(b.action==='criar'&&(!password||typeof password!=='string')||password!==undefined&&password!==''&&(typeof password!=='string'||password.length<6||password.length>128))return reply({error:'Use uma senha de 6 a 128 caracteres.'},400);
  const modules=new Set();
  for(const a of b.acessos){
   if(!a||!['pedidos','producao','salgados'].includes(a.modulo)||modules.has(a.modulo)||!['proprios','unidade','selecionadas','todos'].includes(a.leitura)||!['nenhum','proprios','unidade','selecionadas','todos'].includes(a.edicao)||typeof a.criar!=='boolean'||!Array.isArray(a.unidades)||a.unidades.length>20||a.unidades.some(u=>typeof u!=='string'))return reply({error:'Permissões inválidas.'},400);
   if(a.modulo!=='pedidos'&&(!['proprios','todos'].includes(a.leitura)||!['nenhum','proprios','todos'].includes(a.edicao)))return reply({error:'Escopo inválido para produção ou salgados.'},400);
   modules.add(a.modulo);
  }
  let target=b.usuario_id,created=false;
  if(b.action==='editar'){
   if(!uuid(target)||target===actor||!Number.isSafeInteger(b.revisao_acesso))return reply({error:'Usuário ou revisão inválidos.'},400);
   const existing=await api('/rest/v1/gh_perfis?usuario_id=eq.'+target+'&select=perfil,revisao_acesso');
   if(!existing.ok||!existing.data?.length||existing.data[0].perfil==='administrador')return reply({error:'Conta protegida ou não encontrada.'},403);
   if(existing.data[0].revisao_acesso!==b.revisao_acesso)return reply({error:'Cadastro alterado por outra sessão. Atualize a lista.'},409);
  }else{
   const authEmail=email||'gh-'+crypto.randomUUID()+'@login.guedeshub.invalid';
   const c=await api('/auth/v1/admin/users','POST',{email:authEmail,password,email_confirm:true});
   if(!c.ok)return reply({error:c.status===422||c.status===409?'E-mail já cadastrado ou senha recusada. Confira a lista antes de tentar novamente.':'Não foi possível criar a conta.'},c.status===422||c.status===409?409:500);
   target=c.data?.id;if(!uuid(target))return reply({error:'Resposta de cadastro inválida. Confira a lista antes de repetir.'},500);created=true;
  }
  const config=await api('/rest/v1/rpc/gh_configurar_usuario_login','POST',{ator:actor,alvo:target,nome_novo:nome,casa_nova:b.unidade_codigo||null,ativo_novo:b.ativo!==false,acessos_novos:b.acessos,revisao_esperada:created?null:b.revisao_acesso,login_novo:login});
  if(!config.ok){
   if(created){const cleanup=await api('/auth/v1/admin/users/'+target,'DELETE');if(!cleanup.ok)return reply({error:'O acesso não foi liberado. A conta de autenticação precisa de revisão pelo administrador antes de repetir.'},500)}
   return reply({error:config.data?.code==='23505'?'Nome de acesso já cadastrado. Consulte também os usuários excluídos para restaurar a conta.':'Permissões não foram salvas. Confira a casa, os escopos e atualize a lista antes de tentar novamente.'},409);
  }
  if(!created&&(password||email)){
   const patch={};if(password)patch.password=password;if(email){patch.email=email;patch.email_confirm=true;}
   const r=await api('/auth/v1/admin/users/'+target,'PUT',patch);
   if(!r.ok)return reply({error:'Permissões salvas, mas o e-mail ou a senha não foram atualizados. Confira o cadastro antes de repetir.'},409);
  }
  return reply({usuario_id:target,message:created?'Usuário criado com os acessos definidos.':'Cadastro e permissões atualizados.'},created?201:200);
 }catch{return reply({error:'O serviço não respondeu. Atualize a lista para conferir se a operação foi concluída antes de repetir.'},503)}
}
