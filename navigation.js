 'use strict';
(() => {
const frame=document.getElementById('appFrame'),nav=document.getElementById('appNav'),status=document.getElementById('navStatus');
const labels={importar:'Importar listas',conferir:'Conferir totais',historico:'Histórico de listas',guiado:'Pedido Guiado',producao:'Produção',salgados:'Salgados',painel:'Painel das unidades',gestao:'Gestão local',ajustes:'Ajustes'};
const settings=document.getElementById('settingsDialog');
const settingsOpen=document.getElementById('settingsOpen');
const operational=document.getElementById('operationalSettings');
settingsOpen.onclick=()=>settings.showModal();
settings.addEventListener('click',e=>{if(e.target.closest('#orderRows button')&&/Abrir|Consultar/.test(e.target.textContent))settings.close();});
document.getElementById('settingsClose').onclick=()=>settings.close();
for(const id of ['refresh','restore','importLocal'])document.getElementById(id).addEventListener('click',()=>settings.close());
operational.onclick=()=>{const original=frame.contentDocument?.querySelector('[data-tab="ajustes"]');if(!window.GHCloud?.admin||!original)return;settings.close();original.click();status.textContent='Ajustes operacionais';frame.scrollIntoView({behavior:'smooth',block:'start'});};
let observer;
frame.addEventListener('load',()=>{
observer?.disconnect();nav.replaceChildren();operational.hidden=!window.GHCloud?.admin;
const doc=frame.contentDocument;if(!doc?.querySelector('.tabs'))return;
const tabs=[...doc.querySelectorAll('.tabs [data-tab]')];
// Keep internal controls available to existing handlers; present one navigation.
doc.querySelector('.tabs').style.setProperty('display','none','important');
const update=()=>{for(const b of nav.children){const original=tabs.find(t=>t.dataset.tab===b.dataset.target);b.hidden=original.hidden||getComputedStyle(original).display==='none';b.setAttribute('aria-current',original.classList.contains('active')?'page':'false');}frame.style.height=Math.max(600,doc.body.scrollHeight+24)+'px';};
for(const original of tabs){if(original.dataset.tab==='ajustes')continue;const b=document.createElement('button');b.type='button';b.dataset.target=original.dataset.tab;b.textContent=labels[original.dataset.tab]||original.textContent;b.onclick=()=>{original.click();update();status.textContent=original.classList.contains('active')?b.textContent:'';};nav.append(b);}
const style=doc.createElement('style');style.textContent='body>header{display:none!important}main{width:100%;max-width:1180px;margin:0 auto!important;padding:20px 18px 40px}#gh50-diagnostic{display:none!important}.actions{justify-content:center}.actions button{flex:0 1 auto;min-height:44px}.panel{width:100%;margin-left:auto;margin-right:auto}main>section{min-width:0}.grid>*{min-width:0}@media(max-width:600px){main{padding:16px 12px 28px}.actions button{flex:1 1 140px}}.tabs{flex-wrap:wrap;position:sticky;top:0;z-index:10;background:#f8f5f0;padding:8px 0}.tabs button{flex:1 0 120px;min-height:44px}';doc.head.append(style);
observer=new ResizeObserver(update);observer.observe(doc.body);doc.addEventListener('click',()=>requestAnimationFrame(update));update();
});
})();
