begin;
select set_config('request.jwt.claim.sub',(select usuario_id::text from public.gh_perfis where perfil='administrador' order by usuario_id limit 1),true);
set local role authenticated;
do $$
declare a uuid; n integer;
begin
 insert into public.gh_operacao_central(modulo,data_referencia,dados) values('producao',current_date,'{"teste_automatico":true}') returning id into a;
 perform set_config('gh.teste_central',a::text,true);
 update public.gh_operacao_central set dados='{"teste_automatico":true,"quantidade":2}' where id=a and versao=1;
 get diagnostics n=row_count;if n<>1 then raise exception 'FAIL admin update';end if;
 update public.gh_operacao_central set dados='{"quantidade":99}' where id=a and versao=1;
 get diagnostics n=row_count;if n<>0 then raise exception 'FAIL stale version';end if;
 if (select count(*) from public.gh_alteracoes where referencia=a::text)<>2 then raise exception 'FAIL central audit';end if;
 insert into public.gh_documentos(escopo,chave,valor) values('central','gh43-teste-integracao-v1','{"inicial":true}');
 update public.gh_documentos set valor='{"novo":true}' where escopo='central' and chave='gh43-teste-integracao-v1' and versao=1;
 get diagnostics n=row_count;if n<>1 then raise exception 'FAIL document version';end if;
 if (select count(*) from public.gh_alteracoes where referencia='central/gh43-teste-integracao-v1')<>2 then raise exception 'FAIL doc audit';end if;
end;$$;
reset role;
select set_config('request.jwt.claim.sub',(select usuario_id::text from public.gh_perfis where perfil='unidade' and unidade_codigo='G1' order by usuario_id limit 1),true);
set local role authenticated;
do $$
declare blocked boolean; n integer;
begin
 if exists(select 1 from public.gh_operacao_central) then raise exception 'FAIL central read isolation';end if;
 if exists(select 1 from public.gh_documentos where escopo='central' and chave='gh43-teste-integracao-v1') then raise exception 'FAIL docs isolation';end if;
 if exists(select 1 from public.gh_alteracoes where escopo='central') then raise exception 'FAIL audit isolation';end if;
 insert into public.gh_documentos(escopo,chave,valor) values('G1','gh43-pedido-modelos-v1','[]');
 update public.gh_documentos set valor='["teste"]' where escopo='G1' and chave='gh43-pedido-modelos-v1' and versao=1;
 get diagnostics n=row_count;if n<>1 then raise exception 'FAIL own model update';end if;
 if (select count(*) from public.gh_alteracoes where referencia='G1/gh43-pedido-modelos-v1')<>2 then raise exception 'FAIL unit audit';end if;
 blocked:=false;begin
 insert into public.gh_documentos(escopo,chave,valor) values('G2','gh43-pedido-modelos-v1','[]');
 exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'FAIL other-unit insert';end if;
 blocked:=false;begin
 insert into public.gh_documentos(escopo,chave,valor) values('central','gh43-nao-autorizado-v1','{}');
 exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'FAIL central insert';end if;
 blocked:=false;begin
 update public.gh_perfis set perfil='administrador',unidade_codigo=null where usuario_id=auth.uid();
 exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'FAIL privilege escalation';end if;
 if has_table_privilege(current_user,'public.gh_alteracoes','INSERT,UPDATE,DELETE') then raise exception 'FAIL audit write privileges';end if;
end;$$;
reset role;
set local role anon;
do $$declare blocked boolean:=false;begin
 begin perform 1 from public.gh_documentos;exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'FAIL anonymous access';end if;
end;$$;
reset role;
select 'PASS: admin, unit isolation, document versions, central versions, audit, no privilege escalation, anonymous denial' as resultado;
rollback;
