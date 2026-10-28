const ORIGINS=new Set(['https://fabiorodrigospt-coder.github.io','https://guedeshub.fabiorodrigospt.workers.dev']);
export async function handle(req,env,fetcher=fetch){
 const origin=req.headers.get('origin');const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 if(origin&&ORIGINS.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'});
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!ORIGINS.has(origin))return reply({error:'Origem não autorizada.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Método não permitido.'},405);
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!env.SUPABASE_ANON_KEY)return reply({error:'Login indisponível.'},503);
 const api=async(path,body,privileged=true)=>{
  const key=privileged?env.SUPABASE_SERVICE_ROLE_KEY:env.SUPABASE_ANON_KEY;
  const r=await fetcher(env.SUPABASE_URL+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  let data;try{data=await r.json()}catch{data=null}return {ok:r.ok,status:r.status,data};
 };
 try{
  const text=await req.text();if(text.length>1024)return reply({error:'Usuário ou senha inválidos.'},401);
  let b;try{b=JSON.parse(text)}catch{return reply({error:'Usuário ou senha inválidos.'},401)}
  const login=typeof b.login==='string'?b.login.trim().toLowerCase():'';
  if(!/^[a-z][a-z0-9._-]{2,31}$/.test(login)||typeof b.senha!=='string'||b.senha.length<1||b.senha.length>128)return reply({error:'Usuário ou senha inválidos.'},401);
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(login));const key=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
  const limit=await api('/rest/v1/rpc/gh_limite_login',{chave_hash:key});
  if(!limit.ok)return reply({error:'Login indisponível. Tente novamente.'},503);
  if(limit.data!==true)return reply({error:'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.'},429);
  const found=await api('/rest/v1/rpc/gh_resolver_login',{nome_login:login});
  if(!found.ok)return reply({error:'Login indisponível. Tente novamente.'},503);
  const identity=found.data;
  // GoTrue performs the actual password verification. Never implement password checks here.
  const token=await api('/auth/v1/token?grant_type=password',{email:identity?.email||'unknown@login.guedeshub.invalid',password:b.senha},false);
  if(!token.ok||!identity||token.data?.user?.id!==identity.usuario_id||!token.data?.access_token||!token.data?.refresh_token)return reply({error:'Usuário ou senha inválidos.'},401);
  const current=await api('/rest/v1/rpc/gh_resolver_login',{nome_login:login});
  if(!current.ok||current.data?.usuario_id!==identity.usuario_id)return reply({error:'Usuário ou senha inválidos.'},401);
  await api('/rest/v1/rpc/gh_limpar_limite_login',{chave_hash:key});
  return reply({access_token:token.data.access_token,refresh_token:token.data.refresh_token});
 }catch{return reply({error:'Não foi possível entrar. Tente novamente.'},503)}
}
