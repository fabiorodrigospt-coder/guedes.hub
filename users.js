'use strict';
(() => {
const frame=document.getElementById('appFrame');
const MODULES={pedidos:'Pedidos das casas',producao:'Relatório diário de produção',salgados:'Relatório de salgados'};
frame.addEventListener('load',()=>{
 if(!window.GHCloud?.admin)return;
 const doc=frame.contentDocument,section=doc?.getElementById('gestao');if(!section)return;
 // Legacy local identifications remain stored, but the login manager replaces their form.
 doc.getElementById('gh49Name')?.closest('.gh47-card')?.setAttribute('hidden','');
 const panel=doc.createElement('div');panel.className='panel userManager';panel.id='userManager';
 panel.innerHTML=`<div class="userManagerHead"><div><p class="hint">CONTAS E PERMISSÕES</p><h2>Cadastro de usuários</h2></div><button type="button" class="secondary" id="usrNew">Novo usuário</button></div><p class="hint">Defina a casa, os módulos e o nível de acesso de cada pessoa. O padrão é acessar somente os próprios registros.</p><form id="usrForm" autocomplete="off"><div class="usrGrid"><label>Nome de acesso<input id="usrLogin" required minlength="3" maxlength="32" pattern="[A-Za-z][A-Za-z0-9._-]{2,31}" title="De 3 a 32 caracteres, começando com uma letra, sem espaços ou acentos" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Ex.: GuedesG2"></label><label>Nome para exibir (opcional)<input id="usrName" minlength="2" maxlength="100" autocomplete="off"></label><label>E-mail (opcional)<input id="usrEmail" type="email" autocomplete="off"><small>Na edição, deixe em branco para manter o e-mail atual.</small></label><label>Senha<input id="usrPassword" type="password" minlength="6" maxlength="128" required autocomplete="new-password"><small id="usrPasswordHint">Mínimo de 6 caracteres. A senha não fica guardada neste formulário.</small></label><label>Casa vinculada<select id="usrUnit"><option value="">Equipe de produção / salgados</option></select></label></div><label class="usrCheck"><input id="usrActive" type="checkbox" checked> Conta ativa</label><h3>O que esta pessoa pode acessar?</h3><div id="usrPermissions"></div><div class="actions"><button id="usrSave" class="primary" type="submit">Cadastrar usuário</button></div></form><p id="usrStatus" role="status" aria-live="polite"></p><div class="userManagerHead"><h3>Usuários cadastrados</h3><button id="usrReload" type="button" class="secondary">Atualizar lista</button></div><label class="usrCheck"><input id="usrShowDeleted" type="checkbox"> Mostrar usuários excluídos</label><div id="usrList"></div>`;
 section.prepend(panel);
 const style=doc.createElement('style');style.textContent=`.userManagerHead{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.usrGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.userManager label{display:block}.userManager input:not([type=checkbox]),.userManager select{width:100%;padding:12px;border:1px solid #dac9cc;border-radius:9px;margin-top:6px;font:inherit}.usrCheck{display:flex!important;align-items:center;gap:8px;padding:8px 0}.usrCheck input{width:18px!important;height:18px;margin:0;accent-color:#98132d}.usrPermission{border:1px solid #e6d9db;border-radius:12px;padding:14px;margin:12px 0}.usrPermission legend{font-weight:700;color:#98132d}.usrHouses{display:flex;flex-wrap:wrap;gap:14px}.usrRecord{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:14px 0;border-top:1px solid #eadfe1}.usrUserActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.usrRecord strong,.usrRecord small{display:block;overflow-wrap:anywhere}.usrRecord>div{min-width:0}.userManager [hidden]{display:none!important}#usrStatus{white-space:pre-wrap;overflow-wrap:anywhere}#usrStatus[data-error=true]{color:#a00}@media(max-width:600px){.usrGrid{grid-template-columns:1fr}.usrRecord{align-items:stretch;flex-direction:column}.usrRecord button{align-self:flex-end;max-width:100%}.usrRecord button{flex-shrink:0}}`;
 doc.head.append(style);
 const $=id=>doc.getElementById(id),units=window.GHCloud.unitList;
 for(const [u,n] of units){const o=doc.createElement('option');o.value=u;o.textContent=u+' — '+n;$('usrUnit').append(o);}
 const options=(m,edit)=>[...(edit?[['nenhum','Não pode editar']]:[]),['proprios','Somente os próprios registros'],...(m==='pedidos'?[['unidade','Todos da mesma casa'],['selecionadas','Casas que eu selecionar']]:[]),['todos',m==='pedidos'?'Todas as casas':'Todos os registros do setor']];
 for(const [m,label] of Object.entries(MODULES)){
  const field=doc.createElement('fieldset');field.className='usrPermission';field.dataset.module=m;
  field.innerHTML=`<legend>${label}</legend><label class="usrCheck"><input type="checkbox" data-enabled> Liberar este módulo</label><div data-fields hidden><div class="usrGrid"><label>Pode visualizar<select data-read></select></label><label>Pode editar<select data-edit></select></label></div><label class="usrCheck"><input type="checkbox" data-create checked> Pode criar novos registros</label>${m==='pedidos'?'<p class="hint">Pedidos enviados continuam bloqueados para edição pelas casas.</p><div data-houses hidden><p>Casas adicionais autorizadas</p><div class="usrHouses"></div></div>':''}</div>`;
  for(const [attr,edit] of [['read',false],['edit',true]])for(const [value,text] of options(m,edit)){const o=doc.createElement('option');o.value=value;o.textContent=text;field.querySelector('[data-'+attr+']').append(o)}
  field.querySelector('[data-edit]').value='proprios';
  const update=()=>{field.querySelector('[data-fields]').hidden=!field.querySelector('[data-enabled]').checked;if(m==='pedidos')field.querySelector('[data-houses]').hidden=![field.querySelector('[data-read]').value,field.querySelector('[data-edit]').value].includes('selecionadas');};
  if(m==='pedidos')for(const [u] of units){const l=doc.createElement('label');l.className='usrCheck';const c=doc.createElement('input');c.type='checkbox';c.value=u;l.append(c,doc.createTextNode(u));field.querySelector('.usrHouses').append(l)}
  field.addEventListener('change',update);$('usrPermissions').append(field);
 }
 let editing=null,users=[],busy=false;
 const message=(text,error=false)=>{$('usrStatus').textContent=text;$('usrStatus').dataset.error=String(error);};
 const fill=u=>{
  editing=u||null;$('usrForm').reset();$('usrLogin').value=u?.login_nome||'';$('usrLogin').required=!u||!!u.login_nome;$('usrName').value=u?.nome||'';$('usrEmail').value=u?.email||'';$('usrEmail').readOnly=false;$('usrPassword').value='';$('usrPassword').required=!u;$('usrActive').checked=u?.ativo!==false;$('usrUnit').value=u?.unidade_codigo||'';
  $('usrSave').textContent=u?'Salvar cadastro e acessos':'Cadastrar usuário';$('usrPasswordHint').textContent=u?'Deixe em branco para manter a senha atual. Nova senha: mínimo de 6 caracteres.':'Mínimo de 6 caracteres. A senha não fica guardada neste formulário.';
  for(const f of panel.querySelectorAll('[data-module]')){
   const m=f.dataset.module;let a=u?.acessos?.find(x=>x.modulo===m);
   if(u&&!u.acesso_configurado&&u.perfil==='unidade'&&!u.acessos?.length&&m==='pedidos')a={leitura:'proprios',edicao:'proprios',criar:true,unidades:[]};
   f.querySelector('[data-enabled]').checked=!!a;f.querySelector('[data-read]').value=a?.leitura||'proprios';f.querySelector('[data-edit]').value=a?.edicao||'proprios';f.querySelector('[data-create]').checked=a?.criar!==false;
   for(const c of f.querySelectorAll('.usrHouses input'))c.checked=!!a?.unidades?.includes(c.value);
   f.querySelector('[data-fields]').hidden=!a;
   if(m==='pedidos')f.querySelector('[data-houses]').hidden=![a?.leitura,a?.edicao].includes('selecionadas');
  }
 };
 const refresh=async()=>{
  if(busy)return;message('Carregando usuários…');
  try{const data=await window.GHCloud.manageUsers({action:'listar'});users=data.usuarios;$('usrList').replaceChildren();
   for(const u of users.filter(u=>$('usrShowDeleted').checked||!u.excluido)){const r=doc.createElement('div');r.className='usrRecord';const info=doc.createElement('div'),name=doc.createElement('strong'),description=doc.createElement('small');name.textContent=u.nome+(u.excluido?' · excluído':u.ativo?'':' · desativado');description.textContent=(u.login_nome||u.email||'Sem nome de acesso')+(u.email&&u.login_nome?' · '+u.email:'')+' · '+(u.unidade_codigo||'Equipe')+' · '+(u.perfil==='administrador'?'Administrador':u.acessos.map(a=>MODULES[a.modulo]).join(', ')||(!u.acesso_configurado&&u.perfil==='unidade'?'Pedidos — acesso próprio':'Nenhum módulo liberado'));info.append(name,description);r.append(info);
    if(u.perfil!=='administrador'){const b=doc.createElement('button');b.type='button';b.className='secondary';b.textContent=u.excluido?'Restaurar / editar':'Editar usuário';b.onclick=()=>{fill(u);message('Editando '+u.nome+'.');panel.scrollIntoView({behavior:'smooth',block:'start'});};const actions=doc.createElement('div');actions.className='usrUserActions';actions.append(b);if(!u.excluido){const del=doc.createElement('button');del.type='button';del.className='secondary';del.textContent='Excluir';del.onclick=async()=>{if(busy||!confirm('Excluir '+u.nome+'? O acesso será bloqueado. Pedidos e relatórios serão preservados.'))return;busy=true;del.disabled=true;try{const result=await window.GHCloud.manageUsers({action:'excluir',usuario_id:u.usuario_id,revisao_acesso:u.revisao_acesso});busy=false;await refresh();if(editing?.usuario_id===u.usuario_id)fill();message(result.message);}catch(e){message(e.message,true)}finally{busy=false;del.disabled=false}};actions.append(del)}r.append(actions)}$('usrList').append(r);
   }message('Lista atualizada.');
  }catch(e){message(e.message,true)}
 };
 $('usrNew').onclick=()=>{fill();message('Novo cadastro: selecione os módulos e a casa, quando houver pedidos.');};$('usrReload').onclick=refresh;$('usrShowDeleted').onchange=refresh;
 $('usrForm').onsubmit=async e=>{
  e.preventDefault();if(busy||!$('usrForm').reportValidity())return;
  const acessos=[];
  for(const f of panel.querySelectorAll('[data-module]'))if(f.querySelector('[data-enabled]').checked){const m=f.dataset.module,a={modulo:m,leitura:f.querySelector('[data-read]').value,edicao:f.querySelector('[data-edit]').value,criar:f.querySelector('[data-create]').checked,unidades:[...f.querySelectorAll('.usrHouses input:checked')].map(x=>x.value)};
   if(!['nenhum','proprios',a.leitura].includes(a.edicao)&&a.leitura!=='todos'){message('A edição não pode ser mais ampla que a visualização em '+MODULES[m]+'.',true);return}if(m==='pedidos'&&!$('usrUnit').value){message('Selecione a casa vinculada para liberar pedidos.',true);return}if((a.leitura==='selecionadas'||a.edicao==='selecionadas')&&!a.unidades.length){message('Selecione as casas adicionais autorizadas.',true);return}acessos.push(a);
  }
  if(!acessos.length&&$('usrActive').checked){message('Libere pelo menos um módulo ou desative a conta.',true);return}
  busy=true;$('usrSave').disabled=true;message('Salvando cadastro…');
  const body={action:editing?'editar':'criar',usuario_id:editing?.usuario_id,revisao_acesso:editing?.revisao_acesso,nome:$('usrName').value.trim()||$('usrLogin').value.trim(),login_nome:$('usrLogin').value.trim()||null,email:$('usrEmail').value.trim(),unidade_codigo:$('usrUnit').value||null,ativo:$('usrActive').checked,acessos};
  if($('usrPassword').value)body.senha=$('usrPassword').value;
  try{const result=await window.GHCloud.manageUsers(body);$('usrPassword').value='';busy=false;await refresh();fill();message(result.message);}catch(e){message(e.message,true)}finally{delete body.senha;$('usrPassword').value='';busy=false;$('usrSave').disabled=false;}
 };
 fill();
 // User lists are loaded explicitly; no unrelated account queries on login.
 $('usrList').textContent='Clique em Atualizar lista para consultar e editar os usuários.';
});
})();
