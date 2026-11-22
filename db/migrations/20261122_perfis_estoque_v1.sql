-- Guedes Hub: funções de equipe e razão de estoque.
-- Revisar e aplicar somente após aprovação; não contém execução automática.
begin;

alter table public.gh_perfis
  add column if not exists cargo text not null default 'operador'
  check (cargo in ('administrador','gestor','lider','operador'));
update public.gh_perfis set cargo='administrador' where perfil='administrador';

alter table public.gh_pedidos
  add column if not exists decidido_por uuid references auth.users(id),
  add column if not exists decidido_em timestamptz,
  add column if not exists motivo_devolucao text;
alter table public.gh_pedidos drop constraint if exists gh_pedidos_status_check;
alter table public.gh_pedidos add constraint gh_pedidos_status_check check(status in ('rascunho','enviado','aprovado','devolvido'));
alter table public.gh_pedidos drop constraint if exists gh_pedidos_check;
alter table public.gh_pedidos add constraint gh_pedidos_check check(
  (status in ('rascunho','enviado') and decidido_por is null and decidido_em is null and motivo_devolucao is null)
  or (status='aprovado' and enviado_em is not null and decidido_por is not null and decidido_em is not null and motivo_devolucao is null)
  or (status='devolvido' and enviado_em is not null and decidido_por is not null and decidido_em is not null and length(trim(coalesce(motivo_devolucao,'')))>0)
);

create or replace function public.gh_preparar_edicao() returns trigger language plpgsql set search_path='' as $$
begin
 if row(new.id,new.unidade_codigo,new.criado_por,new.criado_em) is distinct from row(old.id,old.unidade_codigo,old.criado_por,old.criado_em) then raise exception 'Identidade e origem do pedido não podem mudar'; end if;
 if old.status in ('aprovado','devolvido') and new.status is distinct from old.status then raise exception 'A decisão do gestor é final'; end if;
 if old.status='enviado' and new.status not in ('enviado','aprovado','devolvido') then raise exception 'Pedido enviado só pode ser aprovado ou devolvido pelo gestor'; end if;
 if old.status='rascunho' and new.status not in ('rascunho','enviado') then raise exception 'Pedido precisa ser enviado antes da decisão'; end if;
 if old.status='enviado' and new.status in ('aprovado','devolvido') and current_setting('guedeshub.approval_rpc',true) is distinct from 'on' then raise exception 'Use a ação autenticada de aprovação do gestor'; end if;
 new.enviado_em:=old.enviado_em;
 if old.status='rascunho' and new.status='enviado' then new.enviado_em:=now(); end if;
 if old.status='enviado' and new.status in ('aprovado','devolvido') then new.decidido_por:=auth.uid();new.decidido_em:=clock_timestamp();
 elsif new.status not in ('aprovado','devolvido') then new.decidido_por:=null;new.decidido_em:=null;new.motivo_devolucao:=null;end if;
 new.versao:=old.versao+1;new.atualizado_em:=now();return new;
end;$$;

create or replace function public.gh_configurar_usuario_perfil_login(
  ator uuid, alvo uuid, nome_novo text, casa_nova text, ativo_novo boolean,
  acessos_novos jsonb, revisao_esperada bigint, login_novo text, cargo_novo text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare resultado jsonb; anterior jsonb; restaurando boolean;
begin
  if cargo_novo not in ('administrador','gestor','lider','operador') then raise exception 'Tipo de perfil inválido'; end if;
  if not exists(select 1 from public.gh_perfis where usuario_id=ator and perfil='administrador' and ativo and not excluido) then raise exception 'Administrador necessário'; end if;
  if alvo=ator or exists(select 1 from public.gh_perfis where usuario_id=alvo and perfil='administrador') then raise exception 'Conta administrativa protegida'; end if;
  if cargo_novo='administrador' and (revisao_esperada is not null or casa_nova is not null or jsonb_typeof(acessos_novos)<>'array' or jsonb_array_length(acessos_novos)<>0 or ativo_novo) then raise exception 'Administrador só pode ser provisionado como conta nova sem escopo operacional'; end if;
  select jsonb_build_object('perfil',to_jsonb(p),'acessos',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from public.gh_acessos a where a.usuario_id=p.usuario_id)),p.excluido
    into anterior,restaurando from public.gh_perfis p where p.usuario_id=alvo for update;
  resultado:=public.gh_configurar_usuario_login(ator,alvo,nome_novo,casa_nova,ativo_novo,acessos_novos,revisao_esperada,login_novo);
  if cargo_novo='administrador' then
    update public.gh_perfis set perfil='administrador',cargo='administrador',unidade_codigo=null,ativo=true,acesso_configurado=true,revisao_acesso=revisao_acesso+1 where usuario_id=alvo;
  else
    update public.gh_perfis set cargo=cargo_novo,revisao_acesso=revisao_acesso+1 where usuario_id=alvo;
  end if;
  insert into public.gh_usuarios_auditoria(autor_id,usuario_id,anterior,novo)
  values(ator,alvo,anterior,jsonb_build_object('perfil',(select to_jsonb(p) from public.gh_perfis p where usuario_id=alvo),'acessos',acessos_novos));
  return jsonb_build_object('perfil',(select to_jsonb(p) from public.gh_perfis p where usuario_id=alvo),'acessos',acessos_novos);
end;$$;

create or replace function public.gh_listar_usuarios(ator uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.gh_perfis where usuario_id=ator and perfil='administrador' and ativo and not excluido) then raise exception 'Administrador necessário'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object(
  'usuario_id',p.usuario_id,'nome',p.nome,'login_nome',p.login_nome,'excluido',p.excluido,
  'email',case when u.email like '%@login.guedeshub.invalid' then null else u.email end,
  'email_interno',u.email like '%@login.guedeshub.invalid','perfil',p.perfil,'cargo',p.cargo,
  'unidade_codigo',p.unidade_codigo,'ativo',p.ativo,'revisao_acesso',p.revisao_acesso,
  'acesso_configurado',p.acesso_configurado,
  'acessos',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from public.gh_acessos a where a.usuario_id=p.usuario_id)
 ) order by p.nome),'[]'::jsonb) from public.gh_perfis p join auth.users u on u.id=p.usuario_id);
end;$$;

revoke all on function public.gh_configurar_usuario_perfil_login(uuid,uuid,text,text,boolean,jsonb,bigint,text,text) from public,anon,authenticated;
grant execute on function public.gh_configurar_usuario_perfil_login(uuid,uuid,text,text,boolean,jsonb,bigint,text,text) to service_role;

-- Razão append-only: movimentos futuros devem ser lançados por RPC transacional.
create table if not exists public.gh_estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('Proteínas','Francesinha','Doces','Salgados')),
  produto text not null check (length(trim(produto)) between 1 and 120),
  unidade_medida text not null check (unidade_medida in ('un','kg','L','caixa')),
  tipo text not null check (tipo in ('abertura','producao','entrada','saida','consumo','perda','transferencia_saida','transferencia_entrada','pedido_saida')),
  quantidade numeric(14,3) not null check (quantidade > 0),
  local_estoque text not null check (local_estoque in ('central','G1','G2','G4','G5','G7','S1')),
  data_referencia date not null default current_date,
  transferencia_id uuid,
  pedido_id uuid,
  pedido_item_key text,
  referencia text check (length(referencia) <= 160),
  limite_minimo numeric(14,3) check (limite_minimo is null or limite_minimo >= 0),
  semana_inicio date,
  registrado_por uuid not null references auth.users(id),
  registrado_em timestamptz not null default clock_timestamp(),
  constraint gh_estoque_transferencia_pareada check ((tipo like 'transferencia_%') = (transferencia_id is not null)),
  constraint gh_estoque_pedido_ref check ((tipo='pedido_saida' and pedido_id is not null and pedido_item_key is not null) or (tipo<>'pedido_saida' and pedido_id is null and pedido_item_key is null)),
  constraint gh_estoque_abertura_semana check ((tipo='abertura') = (semana_inicio is not null))
);
create index if not exists gh_estoque_produto_local_idx on public.gh_estoque_movimentos(categoria,produto,local_estoque,registrado_em desc);
create index if not exists gh_estoque_data_idx on public.gh_estoque_movimentos(registrado_em desc);
create unique index if not exists gh_estoque_abertura_unica_semana on public.gh_estoque_movimentos(categoria,produto,local_estoque,semana_inicio) where tipo='abertura';
create unique index if not exists gh_estoque_transferencia_unica_tipo on public.gh_estoque_movimentos(transferencia_id,tipo) where transferencia_id is not null;
create unique index if not exists gh_estoque_pedido_debito_item_unico on public.gh_estoque_movimentos(pedido_id,pedido_item_key) where pedido_id is not null;
alter table public.gh_estoque_movimentos enable row level security;
revoke all on public.gh_estoque_movimentos from public,anon,authenticated;
grant select,insert on public.gh_estoque_movimentos to authenticated;
create policy gh_estoque_admin_leitura on public.gh_estoque_movimentos for select to authenticated
 using(exists(select 1 from public.gh_perfis p where p.usuario_id=(select auth.uid()) and p.ativo and not p.excluido and p.perfil='administrador'));
-- Escritas diretas ficam bloqueadas; fluxos operacionais serão autorizados por RPC com verificação de cargo e categoria.
create or replace function gh_privado.gh_estoque_imutavel() returns trigger
language plpgsql security invoker set search_path='' as $$
begin raise exception 'Movimentações de estoque são imutáveis; registre um lançamento de ajuste.'; end;$$;
create trigger gh_estoque_movimento_imutavel before update or delete on public.gh_estoque_movimentos
for each row execute function gh_privado.gh_estoque_imutavel();

create or replace function gh_privado.gh_estoque_saldo(cat text, produto_nome text, um text, local_nome text)
returns numeric language sql stable security definer set search_path='' as $$
 with abertura as (
  select quantidade,semana_inicio from public.gh_estoque_movimentos
  where categoria=cat and produto=produto_nome and unidade_medida=um and local_estoque=local_nome and tipo='abertura'
  order by semana_inicio desc limit 1
 )
 select coalesce((select quantidade from abertura),0)+coalesce((
  select sum(case when m.tipo in ('producao','entrada','transferencia_entrada') then m.quantidade else -m.quantidade end)
  from public.gh_estoque_movimentos m
  where m.categoria=cat and m.produto=produto_nome and m.unidade_medida=um and m.local_estoque=local_nome and m.tipo<>'abertura'
   and (not exists(select 1 from abertura) or m.data_referencia>=(select semana_inicio from abertura))
 ),0)
$$;
revoke all on function gh_privado.gh_estoque_saldo(text,text,text,text) from public,anon,authenticated;

create or replace function public.gh_aprovar_pedido(pedido uuid, versao_esperada bigint, linhas jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 ator uuid:=auth.uid(); p public.gh_pedidos; perfil public.gh_perfis; cat record; item record;
 linha jsonb; quantidade numeric; saldo numeric; abertura numeric; semana date; item_key text; esperado integer:=0;
begin
 if ator is null or jsonb_typeof(linhas)<>'array' then raise exception 'Sessão ou itens de baixa inválidos'; end if;
 select * into perfil from public.gh_perfis where usuario_id=ator and ativo and not excluido;
 if not found or (perfil.perfil<>'administrador' and perfil.cargo<>'gestor') then raise exception 'Aprovação exclusiva de gestor ou administrador'; end if;
 select * into p from public.gh_pedidos where id=pedido for update;
 if not found or p.status<>'enviado' then raise exception 'Pedido não está aguardando aprovação'; end if;
 if p.versao<>versao_esperada then raise exception 'Pedido atualizado em outra sessão; recarregue antes de aprovar'; end if;
 if perfil.perfil<>'administrador' and not gh_privado.gh_tem_acesso('pedidos','editar',p.criado_por,p.unidade_codigo) then raise exception 'Gestor sem acesso de aprovação para este pedido'; end if;
 -- Serializa aprovações para evitar que duas aprovações concorrentes consumam o mesmo saldo.
 perform pg_catalog.pg_advisory_xact_lock(730221);

 for cat in select key,value from jsonb_each(coalesce(p.dados->'values','{}'::jsonb)) loop
  for item in select key,value from jsonb_each(case when jsonb_typeof(cat.value)='object' then cat.value else '{}'::jsonb end) loop
   if coalesce(trim(item.value->>'pedido'),'')='' then continue; end if;
   if (item.value->>'pedido') !~ '^\s*[0-9]+([.,][0-9]+)?\s*$' then raise exception 'Quantidade não numérica no pedido: % / %',cat.key,item.key; end if;
   quantidade:=replace(trim(item.value->>'pedido'),',','.')::numeric;
   if quantidade=0 then continue; end if;
   esperado:=esperado+1;item_key:=cat.key||'|'||item.key;
   select value into linha from jsonb_array_elements(linhas) where value->>'pedido_item_key'=item_key;
   if linha is null then raise exception 'Mapeie o produto do pedido para o estoque: %',item.key; end if;
   if (linha->>'quantidade') is null or (linha->>'quantidade')::numeric<>quantidade or quantidade<>round(quantidade,3) then raise exception 'Quantidade diverge do pedido ou excede três casas decimais para %',item.key; end if;
   if linha->>'categoria' not in ('Proteínas','Francesinha','Doces','Salgados') or linha->>'unidade_medida' not in ('un','kg','L','caixa') then raise exception 'Categoria ou unidade inválida para %',item.key; end if;
   saldo:=gh_privado.gh_estoque_saldo(linha->>'categoria',linha->>'produto',linha->>'unidade_medida','central');
   if saldo<quantidade then raise exception 'Saldo insuficiente na produção para %: disponível %, pedido %',item.key,saldo,quantidade; end if;
   insert into public.gh_estoque_movimentos(categoria,produto,unidade_medida,tipo,quantidade,local_estoque,data_referencia,pedido_id,pedido_item_key,referencia,registrado_por)
    values(linha->>'categoria',linha->>'produto',linha->>'unidade_medida','pedido_saida',quantidade,'central',current_date,pedido,item_key,'Aprovação do pedido '||pedido::text,ator);
  end loop;
 end loop;
 if esperado=0 or jsonb_array_length(linhas)<>esperado then raise exception 'A aprovação precisa mapear todos os itens com quantidade do pedido, sem itens extras'; end if;
 perform set_config('guedeshub.approval_rpc','on',true);
 update public.gh_pedidos set status='aprovado',decidido_por=ator,decidido_em=clock_timestamp()
  where id=pedido and versao=versao_esperada returning * into p;
 return jsonb_build_object('pedido',to_jsonb(p),'baixas',(select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) from public.gh_estoque_movimentos m where m.pedido_id=pedido));
end;$$;
revoke all on function public.gh_aprovar_pedido(uuid,bigint,jsonb) from public,anon;
grant execute on function public.gh_aprovar_pedido(uuid,bigint,jsonb) to authenticated;

create or replace function public.gh_devolver_pedido(pedido uuid, versao_esperada bigint, motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ator uuid:=auth.uid(); p public.gh_pedidos; perfil public.gh_perfis;
begin
 if ator is null or length(trim(coalesce(motivo,'')))<3 or length(motivo)>500 then raise exception 'Informe o motivo da devolução'; end if;
 select * into perfil from public.gh_perfis where usuario_id=ator and ativo and not excluido;
 if not found or (perfil.perfil<>'administrador' and perfil.cargo<>'gestor') then raise exception 'Decisão exclusiva de gestor ou administrador'; end if;
 select * into p from public.gh_pedidos where id=pedido for update;
 if not found or p.status<>'enviado' then raise exception 'Pedido não está aguardando decisão'; end if;
 if p.versao<>versao_esperada then raise exception 'Pedido atualizado em outra sessão; recarregue antes de devolver'; end if;
 if perfil.perfil<>'administrador' and not gh_privado.gh_tem_acesso('pedidos','editar',p.criado_por,p.unidade_codigo) then raise exception 'Gestor sem permissão para este pedido'; end if;
 perform set_config('guedeshub.approval_rpc','on',true);
 update public.gh_pedidos set status='devolvido',motivo_devolucao=trim(motivo),decidido_por=ator,decidido_em=clock_timestamp()
  where id=pedido and versao=versao_esperada returning * into p;
 return to_jsonb(p);
end;$$;
revoke all on function public.gh_devolver_pedido(uuid,bigint,text) from public,anon;
grant execute on function public.gh_devolver_pedido(uuid,bigint,text) to authenticated;

create table if not exists public.gh_estoque_responsaveis (
 categoria text primary key check (categoria in ('Proteínas','Francesinha','Doces','Salgados')),
 usuario_id uuid not null unique references public.gh_perfis(usuario_id),
 definido_por uuid not null references auth.users(id),
 definido_em timestamptz not null default clock_timestamp()
);
alter table public.gh_estoque_responsaveis enable row level security;
revoke all on public.gh_estoque_responsaveis from public,anon,authenticated;
grant select on public.gh_estoque_responsaveis to authenticated;
create policy gh_estoque_responsaveis_admin_ler on public.gh_estoque_responsaveis for select to authenticated
 using(exists(select 1 from public.gh_perfis p where p.usuario_id=(select auth.uid()) and p.ativo and not p.excluido and p.perfil='administrador'));

create or replace function public.gh_configurar_lider_estoque(categoria_nova text, usuario_novo uuid)
returns void language plpgsql security definer set search_path='' as $$
declare ator uuid:=auth.uid();
begin
 if not exists(select 1 from public.gh_perfis where usuario_id=ator and perfil='administrador' and ativo and not excluido) then raise exception 'Atribuição exclusiva do administrador'; end if;
 if categoria_nova not in ('Proteínas','Francesinha','Doces','Salgados') then raise exception 'Categoria inválida'; end if;
 if usuario_novo is null then delete from public.gh_estoque_responsaveis where categoria=categoria_nova; return; end if;
 if not exists(select 1 from public.gh_perfis where usuario_id=usuario_novo and cargo='lider' and ativo and not excluido) then raise exception 'Selecione uma conta ativa do tipo Líder'; end if;
 insert into public.gh_estoque_responsaveis(categoria,usuario_id,definido_por) values(categoria_nova,usuario_novo,ator)
 on conflict(categoria) do update set usuario_id=excluded.usuario_id,definido_por=excluded.definido_por,definido_em=clock_timestamp();
end;$$;
revoke all on function public.gh_configurar_lider_estoque(text,uuid) from public,anon;
grant execute on function public.gh_configurar_lider_estoque(text,uuid) to authenticated;

create or replace function public.gh_estoque_consultar()
returns jsonb language plpgsql security definer set search_path='' as $$
declare ator uuid:=auth.uid(); p public.gh_perfis;
begin
 select * into p from public.gh_perfis where usuario_id=ator and ativo and not excluido;
 if not found then raise exception 'Conta inativa ou sem perfil'; end if;
 if p.perfil<>'administrador' and (p.cargo<>'lider' or not exists(select 1 from public.gh_estoque_responsaveis r where r.usuario_id=ator)) then raise exception 'Acesso ao estoque não configurado'; end if;
 return jsonb_build_object(
  'movimentos',(select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('responsavel',(select x.nome from public.gh_perfis x where x.usuario_id=m.registrado_por)) order by m.registrado_em desc),'[]'::jsonb)
   from public.gh_estoque_movimentos m where p.perfil='administrador' or m.categoria in (select r.categoria from public.gh_estoque_responsaveis r where r.usuario_id=ator)),
  'responsaveis',(select coalesce(jsonb_agg(jsonb_build_object('categoria',r.categoria,'usuario_id',r.usuario_id,'nome',x.nome)),'[]'::jsonb)
   from public.gh_estoque_responsaveis r join public.gh_perfis x on x.usuario_id=r.usuario_id
   where p.perfil='administrador' or r.usuario_id=ator)
 );
end;$$;
revoke all on function public.gh_estoque_consultar() from public,anon;
grant execute on function public.gh_estoque_consultar() to authenticated;

create or replace function public.gh_estoque_lancar(movimento jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ator uuid:=auth.uid(); p public.gh_perfis; cat text; produto_nome text; um text; tipo text; qty numeric; local_nome text; destino text; data_mov date; semana date; min_stock numeric; ref text; transfer uuid; saldo numeric; r public.gh_estoque_movimentos;
begin
 if ator is null or jsonb_typeof(movimento)<>'object' then raise exception 'Movimentação inválida'; end if;
 select * into p from public.gh_perfis where usuario_id=ator and ativo and not excluido;
 if not found then raise exception 'Conta inativa ou sem perfil'; end if;
 cat:=movimento->>'categoria';produto_nome:=trim(movimento->>'produto');um:=movimento->>'unidade_medida';tipo:=movimento->>'tipo';
 qty:=(movimento->>'quantidade')::numeric;local_nome:=coalesce(movimento->>'local_estoque','central');destino:=movimento->>'destino';
 data_mov:=coalesce((movimento->>'data_referencia')::date,current_date);semana:=(movimento->>'semana_inicio')::date;
 min_stock:=nullif(movimento->>'limite_minimo','')::numeric;ref:=nullif(trim(movimento->>'referencia'),'');
 if cat not in ('Proteínas','Francesinha','Doces','Salgados') or produto_nome is null or length(produto_nome)<1 or length(produto_nome)>120 then raise exception 'Categoria ou produto inválido'; end if;
 if um not in ('un','kg','L','caixa') or tipo not in ('abertura','producao','entrada','saida','consumo','perda','transferencia') or qty<=0 or qty<>round(qty,3) then raise exception 'Tipo, unidade ou quantidade inválida (máximo 3 casas decimais)'; end if;
 if local_nome not in ('central','G1','G2','G4','G5','G7','S1') or (tipo='transferencia' and (destino not in ('central','G1','G2','G4','G5','G7','S1') or destino=local_nome)) then raise exception 'Local de estoque inválido'; end if;
 if min_stock is not null and min_stock<0 then raise exception 'Estoque mínimo não pode ser negativo'; end if;
 if (tipo='abertura' and (semana is null or extract(isodow from semana)<>1 or data_mov<semana or data_mov>=semana+7)) or (tipo<>'abertura' and semana is not null) then raise exception 'Estoque inicial exige a segunda-feira de início da semana'; end if;
 if p.perfil<>'administrador' and (p.cargo<>'lider' or not exists(select 1 from public.gh_estoque_responsaveis where usuario_id=ator and categoria=cat)) then raise exception 'Este Líder não está atribuído à categoria'; end if;
 perform pg_catalog.pg_advisory_xact_lock(730221);
 if tipo in ('saida','consumo','perda','transferencia') then
  saldo:=gh_privado.gh_estoque_saldo(cat,produto_nome,um,local_nome);
  if saldo<qty then raise exception 'Saldo insuficiente em %: disponível %, solicitado %',local_nome,saldo,qty; end if;
 end if;
 if tipo='transferencia' then
  transfer:=gen_random_uuid();
  insert into public.gh_estoque_movimentos(categoria,produto,unidade_medida,tipo,quantidade,local_estoque,data_referencia,transferencia_id,referencia,limite_minimo,registrado_por)
   values(cat,produto_nome,um,'transferencia_saida',qty,local_nome,data_mov,transfer,ref,min_stock,ator);
  insert into public.gh_estoque_movimentos(categoria,produto,unidade_medida,tipo,quantidade,local_estoque,data_referencia,transferencia_id,referencia,limite_minimo,registrado_por)
   values(cat,produto_nome,um,'transferencia_entrada',qty,destino,data_mov,transfer,ref,min_stock,ator) returning * into r;
 else
  insert into public.gh_estoque_movimentos(categoria,produto,unidade_medida,tipo,quantidade,local_estoque,data_referencia,semana_inicio,referencia,limite_minimo,registrado_por)
   values(cat,produto_nome,um,tipo,qty,local_nome,data_mov,semana,ref,min_stock,ator) returning * into r;
 end if;
 return jsonb_build_object('movimento',to_jsonb(r),'saldo',gh_privado.gh_estoque_saldo(cat,produto_nome,um,case when tipo='transferencia' then destino else local_nome end));
end;$$;
revoke all on function public.gh_estoque_lancar(jsonb) from public,anon;
grant execute on function public.gh_estoque_lancar(jsonb) to authenticated;


commit;
