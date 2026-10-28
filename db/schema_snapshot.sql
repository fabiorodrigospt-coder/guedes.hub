-- Snapshot do schema Guedes Hub. Restaurar SOMENTE em projeto Supabase vazio.
-- Não contém usuários, senhas, tokens nem dados operacionais.
begin;

create schema if not exists gh_privado;
revoke all on schema gh_privado from public,anon,authenticated;

create table public.gh_alteracoes (
  id uuid default gen_random_uuid() not null,
  tabela text not null,
  referencia text not null,
  escopo text not null,
  autor_id uuid not null,
  registrado_em timestamp with time zone default clock_timestamp() not null,
  operacao text not null,
  anterior jsonb,
  novo jsonb not null
);

create table public.gh_documentos (
  escopo text not null,
  chave text not null,
  valor text not null,
  versao bigint default 1 not null,
  criado_por uuid default auth.uid() not null,
  criado_em timestamp with time zone default now() not null,
  atualizado_em timestamp with time zone default now() not null
);

create table public.gh_operacao_central (
  id uuid default gen_random_uuid() not null,
  modulo text not null,
  data_referencia date not null,
  dados jsonb default '{}'::jsonb not null,
  criado_por uuid default auth.uid() not null,
  criado_em timestamp with time zone default now() not null,
  versao bigint default 1 not null,
  atualizado_em timestamp with time zone default now() not null
);

create table public.gh_pedidos (
  id uuid default gen_random_uuid() not null,
  unidade_codigo text not null,
  criado_por uuid not null,
  status text default 'rascunho'::text not null,
  dados jsonb default '{}'::jsonb not null,
  versao bigint default 1 not null,
  criado_em timestamp with time zone default now() not null,
  atualizado_em timestamp with time zone default now() not null,
  enviado_em timestamp with time zone
);

create table public.gh_pedidos_historico (
  id uuid default gen_random_uuid() not null,
  pedido_id uuid not null,
  unidade_codigo text not null,
  autor_id uuid not null,
  registrado_em timestamp with time zone default clock_timestamp() not null,
  operacao text not null,
  versao bigint not null,
  anterior jsonb,
  novo jsonb not null
);

create table public.gh_perfis (
  usuario_id uuid not null,
  nome text not null,
  perfil text not null,
  unidade_codigo text
);

create table public.gh_unidades (
  codigo text not null,
  nome text not null
);

alter table public.gh_alteracoes add constraint gh_alteracoes_pkey PRIMARY KEY (id);

alter table public.gh_documentos add constraint gh_documentos_chave_check CHECK ((chave ~ '^(gh[0-9]*|guedes)[_-][a-zA-Z0-9_.-]+$'::text));

alter table public.gh_documentos add constraint gh_documentos_escopo_check CHECK ((escopo = ANY (ARRAY['central'::text, 'G1'::text, 'G2'::text, 'G4'::text, 'G5'::text, 'G7'::text, 'S1'::text])));

alter table public.gh_documentos add constraint gh_documentos_pkey PRIMARY KEY (escopo, chave);

alter table public.gh_documentos add constraint gh_documentos_versao_check CHECK ((versao > 0));

alter table public.gh_operacao_central add constraint gh_operacao_central_dados_check CHECK ((jsonb_typeof(dados) = 'object'::text));

alter table public.gh_operacao_central add constraint gh_operacao_central_modulo_check CHECK ((modulo = ANY (ARRAY['producao'::text, 'salgados'::text])));

alter table public.gh_operacao_central add constraint gh_operacao_central_pkey PRIMARY KEY (id);

alter table public.gh_operacao_central add constraint gh_operacao_central_versao_check CHECK ((versao > 0));

alter table public.gh_pedidos_historico add constraint gh_pedidos_historico_operacao_check CHECK ((operacao = ANY (ARRAY['INSERT'::text, 'UPDATE'::text])));

alter table public.gh_pedidos_historico add constraint gh_pedidos_historico_pedido_id_versao_key UNIQUE (pedido_id, versao);

alter table public.gh_pedidos_historico add constraint gh_pedidos_historico_pkey PRIMARY KEY (id);

alter table public.gh_pedidos add constraint gh_pedidos_check CHECK ((((status = 'rascunho'::text) AND (enviado_em IS NULL)) OR ((status = 'enviado'::text) AND (enviado_em IS NOT NULL))));

alter table public.gh_pedidos add constraint gh_pedidos_dados_check CHECK ((jsonb_typeof(dados) = 'object'::text));

alter table public.gh_pedidos add constraint gh_pedidos_pkey PRIMARY KEY (id);

alter table public.gh_pedidos add constraint gh_pedidos_status_check CHECK ((status = ANY (ARRAY['rascunho'::text, 'enviado'::text])));

alter table public.gh_pedidos add constraint gh_pedidos_versao_check CHECK ((versao > 0));

alter table public.gh_perfis add constraint gh_perfis_check CHECK ((((perfil = 'administrador'::text) AND (unidade_codigo IS NULL)) OR ((perfil = 'unidade'::text) AND (unidade_codigo IS NOT NULL))));

alter table public.gh_perfis add constraint gh_perfis_perfil_check CHECK ((perfil = ANY (ARRAY['administrador'::text, 'unidade'::text])));

alter table public.gh_perfis add constraint gh_perfis_pkey PRIMARY KEY (usuario_id);

alter table public.gh_unidades add constraint gh_unidades_pkey PRIMARY KEY (codigo);

alter table public.gh_alteracoes add constraint gh_alteracoes_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES auth.users(id);

alter table public.gh_documentos add constraint gh_documentos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id);

alter table public.gh_operacao_central add constraint gh_operacao_central_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id);

alter table public.gh_pedidos_historico add constraint gh_pedidos_historico_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES auth.users(id);

alter table public.gh_pedidos_historico add constraint gh_pedidos_historico_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES gh_pedidos(id);

alter table public.gh_pedidos_historico add constraint gh_pedidos_historico_unidade_codigo_fkey FOREIGN KEY (unidade_codigo) REFERENCES gh_unidades(codigo);

alter table public.gh_pedidos add constraint gh_pedidos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id);

alter table public.gh_pedidos add constraint gh_pedidos_unidade_codigo_fkey FOREIGN KEY (unidade_codigo) REFERENCES gh_unidades(codigo);

alter table public.gh_perfis add constraint gh_perfis_unidade_codigo_fkey FOREIGN KEY (unidade_codigo) REFERENCES gh_unidades(codigo);

alter table public.gh_perfis add constraint gh_perfis_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id);

CREATE INDEX gh_alteracoes_autor_idx ON public.gh_alteracoes USING btree (autor_id);

CREATE INDEX gh_alteracoes_escopo_data_idx ON public.gh_alteracoes USING btree (escopo, registrado_em DESC);

CREATE INDEX gh_central_autor_idx ON public.gh_operacao_central USING btree (criado_por);

CREATE INDEX gh_documentos_autor_idx ON public.gh_documentos USING btree (criado_por);

CREATE INDEX gh_historico_autor_idx ON public.gh_pedidos_historico USING btree (autor_id);

CREATE INDEX gh_historico_unidade_data_idx ON public.gh_pedidos_historico USING btree (unidade_codigo, registrado_em DESC);

CREATE INDEX gh_operacao_modulo_data_idx ON public.gh_operacao_central USING btree (modulo, data_referencia DESC);

CREATE INDEX gh_pedidos_criador_idx ON public.gh_pedidos USING btree (criado_por);

CREATE INDEX gh_pedidos_unidade_data_idx ON public.gh_pedidos USING btree (unidade_codigo, criado_em DESC);

CREATE INDEX gh_perfis_unidade_idx ON public.gh_perfis USING btree (unidade_codigo);

CREATE UNIQUE INDEX gh_producao_numero_unico ON public.gh_operacao_central USING btree (((dados ->> 'number'::text))) WHERE ((modulo = 'producao'::text) AND ((dados ->> 'number'::text) IS NOT NULL));

CREATE OR REPLACE FUNCTION gh_privado.gh_auditar_operacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end;$function$

revoke all on function gh_privado.gh_auditar_operacao() from public,anon,authenticated;

CREATE OR REPLACE FUNCTION gh_privado.gh_auditar_pedido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  autor uuid := auth.uid();
begin
  if tg_table_schema <> 'public'
     or tg_table_name <> 'gh_pedidos'
     or tg_op not in ('INSERT', 'UPDATE') then
    raise exception 'Contexto de auditoria inválido';
  end if;

  if autor is null or not exists (
    select 1 from public.gh_perfis p
    where p.usuario_id = autor
      and (
        p.perfil = 'administrador'
        or p.unidade_codigo = new.unidade_codigo
      )
  ) then
    raise exception 'Autor não autorizado para auditoria';
  end if;

  insert into public.gh_pedidos_historico (
    pedido_id, unidade_codigo, autor_id,
    operacao, versao, anterior, novo
  )
  values (
    new.id, new.unidade_codigo, autor,
    tg_op, new.versao,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );

  return new;
end;
$function$

revoke all on function gh_privado.gh_auditar_pedido() from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.gh_preparar_edicao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if row(new.id, new.unidade_codigo, new.criado_por, new.criado_em)
     is distinct from
     row(old.id, old.unidade_codigo, old.criado_por, old.criado_em)
  then
    raise exception 'Identidade e origem do pedido não podem mudar';
  end if;

  if old.status = 'enviado' and new.status <> 'enviado' then
    raise exception 'Pedido enviado não pode voltar a rascunho';
  end if;

  new.enviado_em := old.enviado_em;

  if old.status = 'rascunho' and new.status = 'enviado' then
    new.enviado_em := now();
  end if;

  new.versao := old.versao + 1;
  new.atualizado_em := now();
  return new;
end;
$function$

revoke all on function public.gh_preparar_edicao() from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.gh_versionar_documento()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if row(new.escopo,new.chave,new.criado_por,new.criado_em) is distinct from
 row(old.escopo,old.chave,old.criado_por,old.criado_em) then
  raise exception 'Identidade do documento não pode mudar';
 end if;
 new.versao:=old.versao+1;new.atualizado_em:=now();return new;
end;$function$

revoke all on function public.gh_versionar_documento() from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.gh_versionar_operacao_central()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if row(new.id, new.modulo, new.criado_por, new.criado_em)
     is distinct from
     row(old.id, old.modulo, old.criado_por, old.criado_em)
  then
    raise exception 'Identidade e origem do registro não podem mudar';
  end if;

  new.versao := old.versao + 1;
  new.atualizado_em := now();
  return new;
end;
$function$

revoke all on function public.gh_versionar_operacao_central() from public,anon,authenticated;

alter table public.gh_alteracoes enable row level security; revoke all on public.gh_alteracoes from public,anon,authenticated;

alter table public.gh_documentos enable row level security; revoke all on public.gh_documentos from public,anon,authenticated;

alter table public.gh_operacao_central enable row level security; revoke all on public.gh_operacao_central from public,anon,authenticated;

alter table public.gh_pedidos enable row level security; revoke all on public.gh_pedidos from public,anon,authenticated;

alter table public.gh_pedidos_historico enable row level security; revoke all on public.gh_pedidos_historico from public,anon,authenticated;

alter table public.gh_perfis enable row level security; revoke all on public.gh_perfis from public,anon,authenticated;

alter table public.gh_unidades enable row level security; revoke all on public.gh_unidades from public,anon,authenticated;

create policy gh_alteracoes_ler on public.gh_alteracoes as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM gh_perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND ((p.perfil = 'administrador'::text) OR (p.unidade_codigo = gh_alteracoes.escopo))))));

create policy gh_central_consultar on public.gh_operacao_central as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM gh_perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND (p.perfil = 'administrador'::text)))));

create policy gh_central_criar on public.gh_operacao_central as permissive for insert to authenticated with check (((criado_por = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM gh_perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND (p.perfil = 'administrador'::text))))));

create policy gh_central_editar on public.gh_operacao_central as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM gh_perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND (p.perfil = 'administrador'::text))))) with check ((EXISTS ( SELECT 1
   FROM gh_perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND (p.perfil = 'administrador'::text)))));

create policy gh_documentos_criar on public.gh_documentos as permissive for insert to authenticated with check (((criado_por = ( SELECT auth.uid() AS uid)) AND (versao = 1) AND (EXISTS ( SELECT 1
   FROM gh_perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND ((p.perfil = 'administrador'::text) OR ((gh_documentos.escopo = p.unidade_codigo) AND (gh_documentos.chave = ANY (ARRAY['gh27-pedido-guiado-catalogo-v2'::text, 'gh43-pedido-modelos-v1'::text, 'gh38-politicas-estoque-v1'::text, 'guedes-hub-2.2-rascunhos'::text, 'guedes_hub_install_invite_dismissed_v1'::text])))))))));

create policy gh_documentos_editar on public.gh_documentos as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM gh_perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND ((p.perfil = 'administrador'::text) OR ((gh_documentos.escopo = p.unidade_codigo) AND (gh_documentos.chave = ANY (ARRAY['gh27-pedido-guiado-catalogo-v2'::text, 'gh43-pedido-modelos-v1'::text, 'gh38-politicas-estoque-v1'::text, 'guedes-hub-2.2-rascunhos'::text, 'guedes_hub_install_invite_dismissed_v1'::text])))))))) with check ((EXISTS ( SELECT 1
   FROM gh_perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND ((p.perfil = 'administrador'::text) OR ((gh_documentos.escopo = p.unidade_codigo) AND (gh_documentos.chave = ANY (ARRAY['gh27-pedido-guiado-catalogo-v2'::text, 'gh43-pedido-modelos-v1'::text, 'gh38-politicas-estoque-v1'::text, 'guedes-hub-2.2-rascunhos'::text, 'guedes_hub_install_invite_dismissed_v1'::text]))))))));

create policy gh_documentos_ler on public.gh_documentos as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM gh_perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND ((p.perfil = 'administrador'::text) OR (gh_documentos.escopo = p.unidade_codigo) OR ((gh_documentos.escopo = 'central'::text) AND (gh_documentos.chave = 'guedes-hub-catalogo-local-v1'::text)))))));

create policy gh_historico_visivel on public.gh_pedidos_historico as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM gh_perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND ((p.perfil = 'administrador'::text) OR (p.unidade_codigo = gh_pedidos_historico.unidade_codigo))))));

create policy gh_pedidos_criar_rascunho on public.gh_pedidos as permissive for insert to authenticated with check (((criado_por = ( SELECT auth.uid() AS uid)) AND (status = 'rascunho'::text) AND (enviado_em IS NULL) AND (versao = 1) AND (EXISTS ( SELECT 1
   FROM gh_perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND ((p.perfil = 'administrador'::text) OR (p.unidade_codigo = gh_pedidos.unidade_codigo)))))));

create policy gh_pedidos_editar on public.gh_pedidos as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM gh_perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND ((p.perfil = 'administrador'::text) OR ((p.unidade_codigo = gh_pedidos.unidade_codigo) AND (gh_pedidos.status = 'rascunho'::text))))))) with check ((EXISTS ( SELECT 1
   FROM gh_perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND ((p.perfil = 'administrador'::text) OR (p.unidade_codigo = gh_pedidos.unidade_codigo))))));

create policy gh_pedidos_visiveis on public.gh_pedidos as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM gh_perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND ((p.perfil = 'administrador'::text) OR (p.unidade_codigo = gh_pedidos.unidade_codigo))))));

create policy gh_perfil_proprio on public.gh_perfis as permissive for select to authenticated using ((usuario_id = ( SELECT auth.uid() AS uid)));

create policy gh_unidades_visiveis on public.gh_unidades as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM gh_perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND ((p.perfil = 'administrador'::text) OR (p.unidade_codigo = gh_unidades.codigo))))));

grant SELECT on public.gh_alteracoes to authenticated;

grant INSERT on public.gh_documentos to authenticated;

grant SELECT on public.gh_documentos to authenticated;

grant INSERT on public.gh_operacao_central to authenticated;

grant SELECT on public.gh_operacao_central to authenticated;

grant INSERT on public.gh_pedidos to authenticated;

grant SELECT on public.gh_pedidos to authenticated;

grant SELECT on public.gh_pedidos_historico to authenticated;

grant SELECT on public.gh_perfis to authenticated;

grant SELECT on public.gh_unidades to authenticated;

grant UPDATE(valor) on public.gh_documentos to authenticated;

grant UPDATE(dados) on public.gh_operacao_central to authenticated;

grant UPDATE(data_referencia) on public.gh_operacao_central to authenticated;

grant UPDATE(dados) on public.gh_pedidos to authenticated;

grant UPDATE(status) on public.gh_pedidos to authenticated;

CREATE TRIGGER gh_auditar_central AFTER INSERT OR UPDATE ON gh_operacao_central FOR EACH ROW EXECUTE FUNCTION gh_privado.gh_auditar_operacao();

CREATE TRIGGER gh_auditar_documento AFTER INSERT OR UPDATE ON gh_documentos FOR EACH ROW EXECUTE FUNCTION gh_privado.gh_auditar_operacao();

CREATE TRIGGER gh_auditar_pedido AFTER INSERT OR UPDATE ON gh_pedidos FOR EACH ROW EXECUTE FUNCTION gh_privado.gh_auditar_pedido();

CREATE TRIGGER gh_preparar_edicao BEFORE UPDATE ON gh_pedidos FOR EACH ROW EXECUTE FUNCTION gh_preparar_edicao();

CREATE TRIGGER gh_versionar_documento BEFORE UPDATE ON gh_documentos FOR EACH ROW EXECUTE FUNCTION gh_versionar_documento();

CREATE TRIGGER gh_versionar_operacao_central BEFORE UPDATE ON gh_operacao_central FOR EACH ROW EXECUTE FUNCTION gh_versionar_operacao_central();

commit;
