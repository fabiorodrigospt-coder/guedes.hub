'use strict';
const APP='gh-online-'+new URL(self.registration.scope).pathname.replace(/[^a-z0-9]/gi,'_');
const CACHE=APP+'-5-2-v1';
const FILES=['./','./index.html','./workspace.html','./frame-bridge.js','./cloud.js','./online.css','./manifest.webmanifest','./vendor/supabase-2.118.0.js','./casa-guedes-logo.png','./icon-192.png','./icon-512.png'];
const allowed=new Set(FILES.map(f=>new URL(f,self.location.href).pathname));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(APP+'-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const r=event.request,u=new URL(r.url);
 // Only the static application shell is cached. Auth and API requests are never cached.
 if(r.method!=='GET'||u.origin!==self.location.origin||!allowed.has(u.pathname))return;
 event.respondWith(fetch(r).then(async response=>{
  if(response.ok){const copy=response.clone();const canonical=new Request(u.origin+u.pathname);try{await (await caches.open(CACHE)).put(canonical,copy);}catch{}}
  return response;
 }).catch(async()=>{const cached=await caches.match(u.origin+u.pathname);return cached||new Response('Aplicativo indisponível offline. Abra uma vez com internet.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}));
});
