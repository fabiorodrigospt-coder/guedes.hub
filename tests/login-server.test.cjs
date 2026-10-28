const assert=require('node:assert/strict');
(async()=>{
 const {handle}=await import('../supabase/functions/gh-login/handler.js');
 const env={SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-only-key',SUPABASE_ANON_KEY:'public-key'};
 const id='11111111-1111-4111-8111-111111111111';let calls=[],found=true,allowed=true,correct=true;
 const mock=async(url,opts)=>{calls.push({url,opts});let data=true,status=200;
  if(url.includes('gh_limite_login'))data=allowed;
  else if(url.includes('gh_resolver_login'))data=found?{usuario_id:id,email:'private@login.guedeshub.invalid'}:null;
  else if(url.includes('/auth/v1/token')){if(correct&&found)data={user:{id},access_token:'signed-user-token',refresh_token:'session-refresh'};else{data={error:'wrong'};status=400;}}
  else data=null;
  return new Response(JSON.stringify(data),{status});
 };
 const send=(body,origin='https://fabiorodrigospt-coder.github.io')=>handle(new Request('https://test.invalid/gh-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}),env,mock);
 let r=await send({login:'GuedesG2',senha:'123456'});assert.equal(r.status,200);const result=await r.json();assert.deepEqual(Object.keys(result).sort(),['access_token','refresh_token']);assert(!JSON.stringify(result).includes('123456'));assert(!JSON.stringify(result).includes('@'));
 const tokenCall=calls.find(x=>x.url.includes('/auth/v1/token'));assert.equal(tokenCall.opts.headers.apikey,'public-key');assert.equal(JSON.parse(tokenCall.opts.body).password,'123456');
 correct=false;r=await send({login:'guedesg2',senha:'wrong'});assert.equal(r.status,401);const wrong=await r.text();found=false;r=await send({login:'notfound',senha:'wrong'});assert.equal(r.status,401);assert.equal(await r.text(),wrong);
 allowed=false;calls=[];assert.equal((await send({login:'GuedesG2',senha:'123456'})).status,429);assert(!calls.some(x=>x.url.includes('/auth/v1/token')));
 calls=[];assert.equal((await send({login:'GuedesG2',senha:'123456'},'https://evil.invalid')).status,403);assert.equal(calls.length,0);
 assert.equal((await send({login:'a',senha:'123456'})).status,401);
 console.log('PASS: username login, GoTrue password verification, private email mapping, no password in response, generic errors, rate limit and origin restriction.');
})().catch(e=>{console.error(e);process.exit(1)});
