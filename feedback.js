'use strict';
(() => {
 const errors=new Map();let serial=0;
 function clear(el){const hint=errors.get(el);if(!hint)return;hint.remove();el.classList.remove('gh-invalid');el.removeAttribute('aria-invalid');const ids=(el.getAttribute('aria-describedby')||'').split(' ').filter(x=>x&&x!==hint.id);if(ids.length)el.setAttribute('aria-describedby',ids.join(' '));else el.removeAttribute('aria-describedby');errors.delete(el);}
 function mark(el,text='Preencha aqui'){
  if(!el)return;clear(el);const hint=document.createElement('small');hint.id='gh-error-'+(++serial);hint.className='gh-field-error';hint.textContent=text;el.classList.add('gh-invalid');el.setAttribute('aria-invalid','true');el.setAttribute('aria-describedby',((el.getAttribute('aria-describedby')||'')+' '+hint.id).trim());el.insertAdjacentElement('afterend',hint);errors.set(el,hint);
 }
 function focus(){for(const el of [...errors.keys()])if(!el.isConnected)clear(el);const el=[...errors.keys()].find(x=>x.isConnected&&x.getClientRects().length);if(!el)return;el.scrollIntoView({block:'center',behavior:'smooth'});(el.matches('input,select,textarea,button')?el:el.querySelector('input,select,textarea,button'))?.focus({preventScroll:true});}
 function check(fields){let ok=true;for(const [el,valid,message] of fields){if(!el)continue;if(valid)clear(el);else{mark(el,message);ok=false;}}if(!ok)focus();return ok;}
 function form(form){return check([...form.elements].filter(e=>e.willValidate).map(e=>[e,e.validity.valid&&(!e.required||e.value.trim()!==''),e.validity.valueMissing||!e.value.trim()?'Preencha aqui':'Confira este campo']));}
 let hideTimer;
 function show(text,error=false,fromSync=false){if(!fromSync)tracked.clear();if(window.parent!==window&&window.parent.GHFeedback)return window.parent.GHFeedback.show(text,error);clearTimeout(hideTimer);let box=document.getElementById('ghFeedback');if(!box){box=document.createElement('div');box.id='ghFeedback';box.setAttribute('role','status');box.setAttribute('aria-live','polite');document.body.append(box);}box.textContent=text;box.dataset.error=String(error);box.hidden=false;if(!error&&!text.includes('pendente')&&!text.includes('Salvando'))hideTimer=setTimeout(()=>box.hidden=true,4000);}
 const bridge=()=>window.parent===window?window.GHCloud:window.parent.GHCloud;
 const tracked=new Map(),locks=new Map();let lastText='';
 function sync(){for(const [key,button] of locks)button.disabled=bridge()?.saveState?.(key)==='pending';for(const [key,id] of tracked){const state=bridge()?.saveState?.(key);const text=state==='error'?'Erro ao salvar. Veja pendências.':state==='offline'?'Sem internet. Envio pendente.':state==='pending'?'Salvando…':'Salvo ✓';const el=document.getElementById(id);if(el)el.textContent=text;if(text!==lastText){show(text,state==='error',true);lastText=text;}}}
 function saved(key,id){tracked.clear();tracked.set(key,id);lastText='';const button=document.getElementById({'guedes-hub-production-v1':'prodSave','guedes-salgados-v1':'salSave'}[key]);if(button)locks.set(key,button);sync();}
 window.GHValidate={mark,clear,focus,check,form};window.GHFeedback={show,saved};
 document.addEventListener('invalid',e=>{e.preventDefault();mark(e.target,e.target.validity.valueMissing?'Preencha aqui':'Confira este campo');queueMicrotask(focus);},true);
 document.addEventListener('submit',e=>{if(!form(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
 for(const type of ['input','change'])document.addEventListener(type,e=>{clear(e.target);for(const el of [...errors.keys()])if(el.contains(e.target))clear(el);},true);
 document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const $=id=>document.getElementById(id);const filled=id=>[$(id),!!$(id)?.value.trim(),'Preencha aqui'];let checks=[];
  const fields={prodSave:['prodDate','prodResponsible'],prodShare:['prodDate','prodResponsible'],salSave:['salData','salLeader'],salShare:['salData','salLeader'],salAdd:['salProduct','salQty'],gh47AddAlias:['gh47Prod','gh47Alias'],gh47Approve:['gh47Order','gh47Approver'],gh47AddTask:['gh47Task'],gh47AddLoss:['gh47LossProd','gh47Date','gh47Consumption','gh47Loss'],gh48Add:['gh48Name','gh48Category']};
  checks=(fields[b.id]||[]).map(filled);
  if(['prodSave','prodShare'].includes(b.id))for(const el of document.querySelectorAll('[data-prod],[data-stock],[data-order]'))checks.push([el,el.value.trim()===''||/^\d+(?:[.,]\d+)?$/.test(el.value.trim()),'Use 0 ou mais']);
  if(b.id==='salAdd')checks.push([$('salQty'),Number.isSafeInteger(Number($('salQty').value))&&Number($('salQty').value)>0,'Use 1 ou mais']);
  if(b.id==='gh47AddLoss')for(const id of ['gh47Consumption','gh47Loss'])checks.push([$(id),$(id).value!==''&&Number.isFinite(Number($(id).value))&&Number($(id).value)>=0,'Use 0 ou mais']);
  if(!check(checks)){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 window.addEventListener('DOMContentLoaded',()=>{const style=document.createElement('style');style.textContent='.gh-invalid{border:2px solid #b42318!important;background:#fff3f2!important;outline-color:#b42318!important}.gh-field-error{display:block;color:#b42318;font-size:13px;margin:4px 0 8px;font-weight:600}#ghFeedback{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);max-width:calc(100% - 32px);width:max-content;z-index:10000;padding:12px 18px;background:#244c35;color:white;border-radius:10px;box-shadow:0 3px 16px #0003;font:600 14px system-ui;pointer-events:none}#ghFeedback[data-error=true]{background:#b42318}#ghFeedback[hidden]{display:none}';document.head.append(style);});
 window.parent.addEventListener('gh-sync',sync);window.addEventListener('pagehide',()=>window.parent.removeEventListener('gh-sync',sync));
})();
