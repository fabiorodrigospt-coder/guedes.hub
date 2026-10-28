-- Complementa as tabelas gh_pedidos e gh_operacao_central já existentes.
create table public.gh_documentos (
  escopo text not null check (escopo in ('central','G1','G2','G4','G5','G7','S1')),
  chave text not null check (chave ~ '^(gh|guedes)[_-][a-zA-Z0-9_.-]+$'),
  valor text not null,
  versao bigint not null default 1 check (versao > 0),
  criado_por uuid not null default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (escopo,chave)
);
alter table public.gh_documentos enable row level security;
revoke all on public.gh_documentos from public,anon,authenticated;
grant select,insert on public.gh_documentos to authenticated;
grant update(valor) on public.gh_documentos to authenticated;

create policy gh_documentos_ler on public.gh_documentos for select to authenticated
using (exists(select 1 from public.gh_perfis p where p.usuario_id=(select auth.uid()) and (
 p.perfil='administrador' or escopo=p.unidade_codigo
 or (escopo='central' and chave='guedes-hub-catalogo-local-v1')
)));
create policy gh_documentos_criar on public.gh_documentos for insert to authenticated
with check(criado_por=(select auth.uid()) and versao=1 and exists(
 select 1 from public.gh_perfis p where p.usuario_id=(select auth.uid()) and (
 p.perfil='administrador' or (escopo=p.unidade_codigo and chave in (
 'gh27-pedido-guiado-catalogo-v2','gh43-pedido-modelos-v1','gh38-politicas-estoque-v1',
 'guedes-hub-2.2-rascunhos','guedes_hub_install_invite_dismissed_v1'))
)));
create policy gh_documentos_editar on public.gh_documentos for update to authenticated
using(exists(select 1 from public.gh_perfis p where p.usuario_id=(select auth.uid()) and (
 p.perfil='administrador' or (escopo=p.unidade_codigo and chave in (
 'gh27-pedido-guiado-catalogo-v2','gh43-pedido-modelos-v1','gh38-politicas-estoque-v1',
 'guedes-hub-2.2-rascunhos','guedes_hub_install_invite_dismissed_v1')))))
with check(exists(select 1 from public.gh_perfis p where p.usuario_id=(select auth.uid()) and (
 p.perfil='administrador' or (escopo=p.unidade_codigo and chave in (
 'gh27-pedido-guiado-catalogo-v2','gh43-pedido-modelos-v1','gh38-politicas-estoque-v1',
 'guedes-hub-2.2-rascunhos','guedes_hub_install_invite_dismissed_v1')))));

create function public.gh_versionar_documento() returns trigger language plpgsql
security invoker set search_path='' as $$
begin
 if row(new.escopo,new.chave,new.criado_por,new.criado_em) is distinct from
 row(old.escopo,old.chave,old.criado_por,old.criado_em) then
  raise exception 'Identidade do documento não pode mudar';
 end if;
 new.versao:=old.versao+1;new.atualizado_em:=now();return new;
end;$$;
revoke all on function public.gh_versionar_documento() from public,anon,authenticated;
create trigger gh_versionar_documento before update on public.gh_documentos
for each row execute function public.gh_versionar_documento();

create table public.gh_alteracoes (
 id uuid primary key default gen_random_uuid(), tabela text not null,
 referencia text not null, escopo text not null, autor_id uuid not null references auth.users(id),
 registrado_em timestamptz not null default clock_timestamp(), operacao text not null,
 anterior jsonb,novo jsonb not null
);
create index gh_alteracoes_escopo_data_idx on public.gh_alteracoes(escopo,registrado_em desc);
create index gh_alteracoes_autor_idx on public.gh_alteracoes(autor_id);
create index gh_documentos_autor_idx on public.gh_documentos(criado_por);
create index gh_central_autor_idx on public.gh_operacao_central(criado_por);
create index gh_historico_autor_idx on public.gh_pedidos_historico(autor_id);
create index gh_perfis_unidade_idx on public.gh_perfis(unidade_codigo);
alter table public.gh_alteracoes enable row level security;
revoke all on public.gh_alteracoes from public,anon,authenticated;
grant select on public.gh_alteracoes to authenticated;
create policy gh_alteracoes_ler on public.gh_alteracoes for select to authenticated
using(exists(select 1 from public.gh_perfis p where p.usuario_id=(select auth.uid())
 and (p.perfil='administrador' or p.unidade_codigo=escopo)));

create function gh_privado.gh_auditar_operacao() returns trigger language plpgsql
security definer set search_path='' as $$
declare ator uuid:=auth.uid(); area text; ref text;
begin
 if ator is null or tg_table_schema<>'public' or tg_op not in ('INSERT','UPDATE') then
  raise exception 'Contexto não autorizado';
 end if;
 if tg_table_name='gh_operacao_central' then
  area:='central';ref:=new.id::text;
  if not exists(select 1 from public.gh_perfis where usuario_id=ator and perfil='administrador') then
   raise exception 'Operação central exclusiva do administrador';
  end if;
 elsif tg_table_name='gh_documentos' then
  area:=new.escopo;ref:=new.escopo||'/'||new.chave;
  if not exists(select 1 from public.gh_perfis p where p.usuario_id=ator
   and (p.perfil='administrador' or (p.unidade_codigo=area and new.chave in (
   'gh27-pedido-guiado-catalogo-v2','gh43-pedido-modelos-v1','gh38-politicas-estoque-v1',
   'guedes-hub-2.2-rascunhos','guedes_hub_install_invite_dismissed_v1')))) then
   raise exception 'Documento não autorizado';
  end if;
 else raise exception 'Tabela não autorizada'; end if;
 insert into public.gh_alteracoes(tabela,referencia,escopo,autor_id,operacao,anterior,novo)
 values(tg_table_name,ref,area,ator,tg_op,
 case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end;$$;
revoke all on function gh_privado.gh_auditar_operacao() from public,anon,authenticated;
create trigger gh_auditar_central after insert or update on public.gh_operacao_central
for each row execute function gh_privado.gh_auditar_operacao();
create trigger gh_auditar_documento after insert or update on public.gh_documentos
for each row execute function gh_privado.gh_auditar_operacao();
