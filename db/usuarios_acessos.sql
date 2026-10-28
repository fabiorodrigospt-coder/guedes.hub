begin;
alter table public.gh_perfis add column codigo_relatorio bigint generated always as identity, add column acesso_configurado boolean not null default false, add column ativo boolean not null default true, add column revisao_acesso bigint not null default 1;
alter table public.gh_perfis drop constraint gh_perfis_check, drop constraint gh_perfis_perfil_check;
alter table public.gh_perfis add constraint gh_perfis_perfil_check check(perfil in ('administrador','unidade','colaborador')),
 add constraint gh_perfis_check check((perfil='administrador' and unidade_codigo is null) or (perfil='unidade' and unidade_codigo is not null) or perfil='colaborador');
create table public.gh_acessos (
 usuario_id uuid not null references public.gh_perfis(usuario_id), modulo text not null check(modulo in ('pedidos','producao','salgados')),
 leitura text not null default 'proprios' check(leitura in ('proprios','unidade','selecionadas','todos')),
 edicao text not null default 'proprios' check(edicao in ('nenhum','proprios','unidade','selecionadas','todos')),
 criar boolean not null default true, unidades text[] not null default '{}', primary key(usuario_id,modulo),
 check(modulo='pedidos' or (leitura in ('proprios','todos') and edicao in ('nenhum','proprios','todos'))),
 check(edicao='nenhum' or edicao='proprios' or edicao=leitura or leitura='todos'),
 check(modulo<>'pedidos' or leitura<>'selecionadas' or cardinality(unidades)>0)
);
alter table public.gh_acessos enable row level security;
revoke all on public.gh_acessos from public,anon,authenticated;
grant select on public.gh_acessos to authenticated;
create policy gh_acesso_proprio on public.gh_acessos for select to authenticated using(usuario_id=(select auth.uid()));
create table public.gh_usuarios_auditoria (
 id uuid primary key default gen_random_uuid(),autor_id uuid not null references auth.users(id),usuario_id uuid not null references auth.users(id),
 registrado_em timestamptz not null default now(),anterior jsonb,novo jsonb not null
);
create index gh_usuarios_auditoria_usuario_idx on public.gh_usuarios_auditoria(usuario_id,registrado_em desc);
alter table public.gh_usuarios_auditoria enable row level security;
revoke all on public.gh_usuarios_auditoria from public,anon,authenticated;
-- This helper checks the current account, never an editable JWT metadata claim.
create function gh_privado.gh_tem_acesso(m text,acao text,dono uuid,casa text default null) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare p public.gh_perfis; a public.gh_acessos; regra text; eu uuid:=auth.uid();
begin
 select * into p from public.gh_perfis where usuario_id=eu;
 if not found or not p.ativo then return false;end if;
 if p.perfil='administrador' then return true;end if;
 if m not in ('pedidos','producao','salgados') or acao not in ('ler','editar','criar') then return false;end if;
 select * into a from public.gh_acessos where usuario_id=eu and modulo=m;
 if not found then
  return not p.acesso_configurado and p.perfil='unidade' and m='pedidos' and dono=eu and casa=p.unidade_codigo;
 end if;
 if acao='criar' then
  return a.criar and dono=eu and (m<>'pedidos' or casa=p.unidade_codigo or casa=any(a.unidades) or a.leitura='todos');
 end if;
 -- Editing a row necessarily includes being able to read it.
 foreach regra in array case when acao='ler' then array[a.leitura,a.edicao] else array[a.edicao] end loop
  if regra='todos' or (regra='proprios' and dono=eu and (m<>'pedidos' or casa=p.unidade_codigo or casa=any(a.unidades))) or (m='pedidos' and regra='unidade' and casa=p.unidade_codigo)
   or (m='pedidos' and regra='selecionadas' and (casa=p.unidade_codigo or casa=any(a.unidades))) then return true;end if;
 end loop;
 return false;
end;$$;
revoke all on function gh_privado.gh_tem_acesso(text,text,uuid,text) from public,anon;
grant usage on schema gh_privado to authenticated;
grant execute on function gh_privado.gh_tem_acesso(text,text,uuid,text) to authenticated;
create function gh_privado.gh_documento_acesso(area text,chave_doc text,dono uuid,escrever boolean) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare p public.gh_perfis;
begin
 select * into p from public.gh_perfis where usuario_id=auth.uid();
 if not found or not p.ativo then return false;end if;
 if p.perfil='administrador' then return true;end if;
 if not escrever and area='central' and chave_doc='guedes-hub-catalogo-local-v1' then return true;end if;
 return area='usuario:'||p.usuario_id::text or (area=p.unidade_codigo and dono=p.usuario_id);
end;$$;
revoke all on function gh_privado.gh_documento_acesso(text,text,uuid,boolean) from public,anon;
grant execute on function gh_privado.gh_documento_acesso(text,text,uuid,boolean) to authenticated;
alter table public.gh_documentos drop constraint gh_documentos_escopo_check;
alter table public.gh_documentos add constraint gh_documentos_escopo_check check(escopo in ('central','G1','G2','G4','G5','G7','S1') or escopo ~ '^usuario:[0-9a-f-]{36}$');
-- Replace existing permissive policies; leaving them in place would widen access.
drop policy gh_pedidos_visiveis on public.gh_pedidos;
drop policy gh_pedidos_criar_rascunho on public.gh_pedidos;
drop policy gh_pedidos_editar on public.gh_pedidos;
create policy gh_pedidos_visiveis on public.gh_pedidos for select to authenticated using(gh_privado.gh_tem_acesso('pedidos','ler',criado_por,unidade_codigo));
create policy gh_pedidos_criar_rascunho on public.gh_pedidos for insert to authenticated with check(criado_por=(select auth.uid()) and status='rascunho' and enviado_em is null and versao=1 and gh_privado.gh_tem_acesso('pedidos','criar',criado_por,unidade_codigo));
create policy gh_pedidos_editar on public.gh_pedidos for update to authenticated
 using(gh_privado.gh_tem_acesso('pedidos','editar',criado_por,unidade_codigo) and (status='rascunho' or exists(select 1 from public.gh_perfis where usuario_id=(select auth.uid()) and perfil='administrador' and ativo)))
 with check(gh_privado.gh_tem_acesso('pedidos','editar',criado_por,unidade_codigo));
drop policy gh_historico_visivel on public.gh_pedidos_historico;
create policy gh_historico_visivel on public.gh_pedidos_historico for select to authenticated using(exists(select 1 from public.gh_pedidos p where p.id=pedido_id));
drop policy gh_central_consultar on public.gh_operacao_central;
drop policy gh_central_criar on public.gh_operacao_central;
drop policy gh_central_editar on public.gh_operacao_central;
create policy gh_central_consultar on public.gh_operacao_central for select to authenticated using(gh_privado.gh_tem_acesso(modulo,'ler',criado_por));
create policy gh_central_criar on public.gh_operacao_central for insert to authenticated with check(criado_por=(select auth.uid()) and versao=1 and gh_privado.gh_tem_acesso(modulo,'criar',criado_por));
create policy gh_central_editar on public.gh_operacao_central for update to authenticated using(gh_privado.gh_tem_acesso(modulo,'editar',criado_por)) with check(gh_privado.gh_tem_acesso(modulo,'editar',criado_por));
drop policy gh_documentos_ler on public.gh_documentos;
drop policy gh_documentos_criar on public.gh_documentos;
drop policy gh_documentos_editar on public.gh_documentos;
create policy gh_documentos_ler on public.gh_documentos for select to authenticated using(gh_privado.gh_documento_acesso(escopo,chave,criado_por,false));
create policy gh_documentos_criar on public.gh_documentos for insert to authenticated with check(criado_por=(select auth.uid()) and versao=1 and gh_privado.gh_documento_acesso(escopo,chave,criado_por,true));
create policy gh_documentos_editar on public.gh_documentos for update to authenticated using(gh_privado.gh_documento_acesso(escopo,chave,criado_por,true)) with check(gh_privado.gh_documento_acesso(escopo,chave,criado_por,true));
drop policy gh_unidades_visiveis on public.gh_unidades;
create policy gh_unidades_visiveis on public.gh_unidades for select to authenticated using(exists(
 select 1 from public.gh_perfis p where p.usuario_id=(select auth.uid()) and p.ativo and (p.perfil='administrador' or p.unidade_codigo=codigo or exists(select 1 from public.gh_acessos a where a.usuario_id=p.usuario_id and a.modulo='pedidos' and (a.leitura='todos' or codigo=any(a.unidades))))));
drop policy gh_alteracoes_ler on public.gh_alteracoes;
create policy gh_alteracoes_ler on public.gh_alteracoes for select to authenticated using(exists(select 1 from public.gh_perfis where usuario_id=(select auth.uid()) and perfil='administrador' and ativo));
create or replace function gh_privado.gh_auditar_pedido() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_schema<>'public' or tg_table_name<>'gh_pedidos' or tg_op not in ('INSERT','UPDATE') or not gh_privado.gh_tem_acesso('pedidos',case when tg_op='INSERT' then 'criar' else 'editar' end,new.criado_por,new.unidade_codigo) then raise exception 'Autor não autorizado para auditoria';end if;
 insert into public.gh_pedidos_historico(pedido_id,unidade_codigo,autor_id,operacao,versao,anterior,novo)
 values(new.id,new.unidade_codigo,auth.uid(),tg_op,new.versao,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;
end;$$;
create or replace function gh_privado.gh_auditar_operacao() returns trigger language plpgsql security definer set search_path='' as $$
declare area text;ref text;
begin
 if auth.uid() is null or tg_table_schema<>'public' or tg_op not in ('INSERT','UPDATE') then raise exception 'Contexto não autorizado';end if;
 if tg_table_name='gh_operacao_central' then
  area:='central';ref:=new.id::text;
  if not gh_privado.gh_tem_acesso(new.modulo,case when tg_op='INSERT' then 'criar' else 'editar' end,new.criado_por) then raise exception 'Operação não autorizada';end if;
 elsif tg_table_name='gh_documentos' then
  area:=new.escopo;ref:=new.escopo||'/'||new.chave;
  if not gh_privado.gh_documento_acesso(area,new.chave,new.criado_por,true) then raise exception 'Documento não autorizado';end if;
 else raise exception 'Tabela não autorizada';end if;
 insert into public.gh_alteracoes(tabela,referencia,escopo,autor_id,operacao,anterior,novo)
 values(tg_table_name,ref,area,auth.uid(),tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;
end;$$;
-- Auth provisioning happens in the server function. Only service_role can call this transactional RPC.
create function public.gh_configurar_usuario(ator uuid,alvo uuid,nome_novo text,casa_nova text,ativo_novo boolean,acessos_novos jsonb,revisao_esperada bigint default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare anterior jsonb;novo jsonb;p public.gh_perfis;a jsonb;chave text;
begin
 if not exists(select 1 from public.gh_perfis where usuario_id=ator and perfil='administrador' and ativo) then raise exception 'Administrador necessário';end if;
 if alvo=ator or exists(select 1 from public.gh_perfis where usuario_id=alvo and perfil='administrador') then raise exception 'Conta de administrador protegida';end if;
 if length(trim(nome_novo))<2 or length(nome_novo)>100 or jsonb_typeof(acessos_novos)<>'array' or jsonb_array_length(acessos_novos)>3 then raise exception 'Cadastro inválido';end if;
 if casa_nova is not null and not exists(select 1 from public.gh_unidades where codigo=casa_nova) then raise exception 'Casa inválida';end if;
 select * into p from public.gh_perfis where usuario_id=alvo for update;
 if found then
  if revisao_esperada is null or p.revisao_acesso<>revisao_esperada then raise exception 'Conflito: atualize o cadastro antes de salvar';end if;
  anterior:=jsonb_build_object('perfil',to_jsonb(p),'acessos',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.gh_acessos x where usuario_id=alvo));
 elsif revisao_esperada is not null then raise exception 'Cadastro inexistente';end if;
 for a in select value from jsonb_array_elements(acessos_novos) loop
  if a->>'modulo'='pedidos' and casa_nova is null then raise exception 'Selecione a casa para pedidos';end if;
  if jsonb_typeof(a->'unidades')<>'array' then raise exception 'Casas inválidas';end if;
  for chave in select jsonb_array_elements_text(a->'unidades') loop
   if not exists(select 1 from public.gh_unidades where codigo=chave) then raise exception 'Casa não cadastrada';end if;
  end loop;
 end loop;
 insert into public.gh_perfis(usuario_id,nome,perfil,unidade_codigo,ativo,revisao_acesso,acesso_configurado)
 values(alvo,trim(nome_novo),case when casa_nova is null then 'colaborador' else 'unidade' end,casa_nova,ativo_novo,1,true)
 on conflict(usuario_id) do update set nome=excluded.nome,perfil=excluded.perfil,unidade_codigo=excluded.unidade_codigo,ativo=excluded.ativo,acesso_configurado=true,revisao_acesso=public.gh_perfis.revisao_acesso+1;
 delete from public.gh_acessos where usuario_id=alvo;
 insert into public.gh_acessos(usuario_id,modulo,leitura,edicao,criar,unidades)
 select alvo,e.value->>'modulo',e.value->>'leitura',e.value->>'edicao',(e.value->>'criar')::boolean,array(select jsonb_array_elements_text(e.value->'unidades')) from jsonb_array_elements(acessos_novos) as e(value);
 -- An explicit empty access list must NOT activate the legacy unit fallback.
 if not exists(select 1 from public.gh_acessos where usuario_id=alvo) then
  update public.gh_perfis set ativo=false where usuario_id=alvo;
 end if;
 novo:=jsonb_build_object('perfil',(select to_jsonb(x) from public.gh_perfis x where usuario_id=alvo),'acessos',acessos_novos);
 insert into public.gh_usuarios_auditoria(autor_id,usuario_id,anterior,novo) values(ator,alvo,anterior,novo);
 return novo;
end;$$;
revoke all on function public.gh_configurar_usuario(uuid,uuid,text,text,boolean,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.gh_configurar_usuario(uuid,uuid,text,text,boolean,jsonb,bigint) to service_role;
create function public.gh_listar_usuarios(ator uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.gh_perfis where usuario_id=ator and perfil='administrador' and ativo) then raise exception 'Administrador necessário';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('usuario_id',p.usuario_id,'nome',p.nome,'email',u.email,'perfil',p.perfil,'unidade_codigo',p.unidade_codigo,'ativo',p.ativo,'revisao_acesso',p.revisao_acesso,'acesso_configurado',p.acesso_configurado,'acessos',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from public.gh_acessos a where a.usuario_id=p.usuario_id)) order by p.nome),'[]'::jsonb) from public.gh_perfis p join auth.users u on u.id=p.usuario_id);
end;$$;
revoke all on function public.gh_listar_usuarios(uuid) from public,anon,authenticated;
grant execute on function public.gh_listar_usuarios(uuid) to service_role;
create index gh_pedidos_autor_idx on public.gh_pedidos(criado_por,unidade_codigo);
create index gh_operacao_autor_idx on public.gh_operacao_central(criado_por,modulo);
commit;
