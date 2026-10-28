begin;
alter table public.gh_perfis add column login_nome text, add column excluido boolean not null default false;
alter table public.gh_perfis add constraint gh_login_formato check(login_nome is null or login_nome ~ '^[A-Za-z][A-Za-z0-9._-]{2,31}$');
create unique index gh_login_unico on public.gh_perfis(lower(login_nome)) where login_nome is not null;
create table gh_privado.gh_login_limites(chave text primary key,janela timestamptz not null default now(),tentativas integer not null default 1);
create index gh_login_limites_janela_idx on gh_privado.gh_login_limites(janela);
alter table gh_privado.gh_login_limites enable row level security;
revoke all on gh_privado.gh_login_limites from public,anon,authenticated;
create function public.gh_limite_login(chave_hash text) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if chave_hash !~ '^[a-f0-9]{64}$' then return false;end if;
 delete from gh_privado.gh_login_limites where janela<now()-interval '1 day';
 insert into gh_privado.gh_login_limites(chave) values(chave_hash)
 on conflict(chave) do update set tentativas=case when gh_privado.gh_login_limites.janela<now()-interval '15 minutes' then 1 else gh_privado.gh_login_limites.tentativas+1 end,
 janela=case when gh_privado.gh_login_limites.janela<now()-interval '15 minutes' then now() else gh_privado.gh_login_limites.janela end returning tentativas into n;
 return n<=10;
end;$$;
create function public.gh_limpar_limite_login(chave_hash text) returns void language sql security definer set search_path='' as $$delete from gh_privado.gh_login_limites where chave=chave_hash;$$;
create function public.gh_resolver_login(nome_login text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('usuario_id',p.usuario_id,'email',u.email) from public.gh_perfis p join auth.users u on u.id=p.usuario_id
 where lower(p.login_nome)=lower(trim(nome_login)) and p.ativo and not p.excluido;
$$;
create function public.gh_configurar_usuario_login(ator uuid,alvo uuid,nome_novo text,casa_nova text,ativo_novo boolean,acessos_novos jsonb,revisao_esperada bigint,login_novo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare resultado jsonb;anterior text;restaurando boolean;
begin
 if login_novo is not null and login_novo !~ '^[A-Za-z][A-Za-z0-9._-]{2,31}$' then raise exception 'Nome de acesso inválido';end if;
 select login_nome,excluido into anterior,restaurando from public.gh_perfis where usuario_id=alvo for update;
 resultado:=public.gh_configurar_usuario(ator,alvo,nome_novo,casa_nova,ativo_novo,acessos_novos,revisao_esperada);
 update public.gh_perfis set login_nome=coalesce(login_novo,login_nome),excluido=false where usuario_id=alvo;
 if login_novo is distinct from anterior and login_novo is not null or restaurando then
  insert into public.gh_usuarios_auditoria(autor_id,usuario_id,anterior,novo) values(ator,alvo,jsonb_build_object('login_nome',anterior,'excluido',restaurando),jsonb_build_object('login_nome',coalesce(login_novo,anterior),'excluido',false));
 end if;
 return resultado;
end;$$;
create function public.gh_excluir_usuario(ator uuid,alvo uuid,revisao_esperada bigint) returns void language plpgsql security definer set search_path='' as $$
declare p public.gh_perfis;
begin
 if not exists(select 1 from public.gh_perfis where usuario_id=ator and perfil='administrador' and ativo and not excluido) then raise exception 'Administrador necessário';end if;
 select * into p from public.gh_perfis where usuario_id=alvo for update;
 if not found or alvo=ator or p.perfil='administrador' then raise exception 'Conta protegida ou inexistente';end if;
 if p.revisao_acesso<>revisao_esperada then raise exception 'Conflito: atualize a lista';end if;
 update public.gh_perfis set ativo=false,excluido=true,revisao_acesso=revisao_acesso+1 where usuario_id=alvo;
 insert into public.gh_usuarios_auditoria(autor_id,usuario_id,anterior,novo) values(ator,alvo,to_jsonb(p),jsonb_build_object('ativo',false,'excluido',true));
end;$$;
create or replace function public.gh_listar_usuarios(ator uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.gh_perfis where usuario_id=ator and perfil='administrador' and ativo and not excluido) then raise exception 'Administrador necessário';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('usuario_id',p.usuario_id,'nome',p.nome,'login_nome',p.login_nome,'excluido',p.excluido,
 'email',case when u.email like '%@login.guedeshub.invalid' then null else u.email end,'email_interno',u.email like '%@login.guedeshub.invalid',
 'perfil',p.perfil,'unidade_codigo',p.unidade_codigo,'ativo',p.ativo,'revisao_acesso',p.revisao_acesso,'acesso_configurado',p.acesso_configurado,
 'acessos',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from public.gh_acessos a where a.usuario_id=p.usuario_id)) order by p.nome),'[]'::jsonb)
 from public.gh_perfis p join auth.users u on u.id=p.usuario_id);
end;$$;
revoke all on function public.gh_limite_login(text),public.gh_limpar_limite_login(text),public.gh_resolver_login(text),public.gh_configurar_usuario_login(uuid,uuid,text,text,boolean,jsonb,bigint,text),public.gh_excluir_usuario(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.gh_limite_login(text),public.gh_limpar_limite_login(text),public.gh_resolver_login(text),public.gh_configurar_usuario_login(uuid,uuid,text,text,boolean,jsonb,bigint,text),public.gh_excluir_usuario(uuid,uuid,bigint) to service_role;
commit;
