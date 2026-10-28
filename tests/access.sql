begin;
-- Temporary auth identities only; this entire test is rolled back.
select set_config('gh.test.admin',(select usuario_id::text from public.gh_perfis where perfil='administrador' and ativo limit 1),true);
select set_config('gh.test.a',gen_random_uuid()::text,true),set_config('gh.test.b',gen_random_uuid()::text,true),set_config('gh.test.c',gen_random_uuid()::text,true);
insert into auth.users(id,email,aud,role) values
(current_setting('gh.test.a')::uuid,'gh-test-a@example.invalid','authenticated','authenticated'),
(current_setting('gh.test.b')::uuid,'gh-test-b@example.invalid','authenticated','authenticated'),
(current_setting('gh.test.c')::uuid,'gh-test-c@example.invalid','authenticated','authenticated');
insert into public.gh_perfis(usuario_id,nome,perfil,unidade_codigo,acesso_configurado) values
(current_setting('gh.test.a')::uuid,'Teste A','unidade','G1',true),
(current_setting('gh.test.b')::uuid,'Teste B','unidade','G1',true),
(current_setting('gh.test.c')::uuid,'Teste C','unidade','G2',true);
insert into public.gh_acessos(usuario_id,modulo) select current_setting('gh.test.'||x)::uuid,m from unnest(array['a','b','c']) x cross join unnest(array['pedidos','producao','salgados']) m;
select set_config('request.jwt.claim.sub',current_setting('gh.test.b'),true);
set local role authenticated;
insert into public.gh_pedidos(unidade_codigo,criado_por,dados) values('G1',auth.uid(),'{"teste":"outro da mesma casa"}');
insert into public.gh_operacao_central(modulo,data_referencia,dados) values('producao',current_date,'{"teste":"outro produtor"}'),('salgados',current_date,'{"teste":"outro salgadeiro"}');
reset role;
select set_config('request.jwt.claim.sub',current_setting('gh.test.c'),true);
set local role authenticated;
insert into public.gh_pedidos(unidade_codigo,criado_por,dados) values('G2',auth.uid(),'{"teste":"outra casa"}');
reset role;
select set_config('request.jwt.claim.sub',current_setting('gh.test.a'),true);
set local role authenticated;
do $$declare n integer;blocked boolean;id_p uuid;id_c uuid;begin
 if exists(select 1 from public.gh_pedidos) then raise exception 'FAIL own orders isolation';end if;
 if exists(select 1 from public.gh_operacao_central) then raise exception 'FAIL own central isolation';end if;
 insert into public.gh_pedidos(unidade_codigo,criado_por,dados) values('G1',auth.uid(),'{"teste":"proprio"}') returning id into id_p;
 perform set_config('gh.test.order',id_p::text,true);
 update public.gh_pedidos set dados='{"teste":"editado"}' where id=id_p and versao=1;
 get diagnostics n=row_count;if n<>1 then raise exception 'FAIL own edit';end if;
 if (select count(*) from public.gh_pedidos_historico where pedido_id=id_p)<>2 then raise exception 'FAIL order audit';end if;
 update public.gh_pedidos set status='enviado' where id=id_p;
 update public.gh_pedidos set dados='{"indevido":true}' where id=id_p;
 get diagnostics n=row_count;if n<>0 then raise exception 'FAIL sent order lock';end if;
 insert into public.gh_operacao_central(modulo,data_referencia,dados) values('producao',current_date,'{"teste":"meu"}') returning id into id_c;
 update public.gh_operacao_central set dados='{"teste":"editado"}' where id=id_c and versao=1;
 get diagnostics n=row_count;if n<>1 then raise exception 'FAIL own production edit';end if;
 insert into public.gh_operacao_central(modulo,data_referencia,dados) values('salgados',current_date,'{"teste":"meu salgado"}');
 insert into public.gh_documentos(escopo,chave,valor) values('usuario:'||auth.uid()::text,'gh43-pedido-modelos-v1','[]');
 blocked:=false;begin insert into public.gh_pedidos(unidade_codigo,criado_por,dados) values('G2',auth.uid(),'{}');exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'FAIL create in another house';end if;
 update public.gh_pedidos set dados='{}' where criado_por<>auth.uid();get diagnostics n=row_count;if n<>0 then raise exception 'FAIL other edit';end if;
 blocked:=false;begin update public.gh_acessos set leitura='todos' where usuario_id=auth.uid();exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'FAIL self escalation';end if;
 blocked:=false;begin perform public.gh_configurar_usuario(auth.uid(),auth.uid(),'Teste','G1',true,'[]',1);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'FAIL provisioning RPC exposure';end if;
end;$$;
reset role;
-- Same-house read without edit; other houses stay invisible.
update public.gh_acessos set leitura='unidade',edicao='proprios' where usuario_id=current_setting('gh.test.a')::uuid and modulo='pedidos';
set local role authenticated;
do $$declare n integer;begin
 if (select count(*) from public.gh_pedidos where criado_por in(current_setting('gh.test.a')::uuid,current_setting('gh.test.b')::uuid,current_setting('gh.test.c')::uuid))<>2 then raise exception 'FAIL same-house read';end if;
 update public.gh_pedidos set dados='{}' where criado_por<>auth.uid();get diagnostics n=row_count;if n<>0 then raise exception 'FAIL read-only other user';end if;
end;$$;
reset role;
update public.gh_acessos set leitura='selecionadas',edicao='selecionadas',unidades=array['G2'] where usuario_id=current_setting('gh.test.a')::uuid and modulo='pedidos';
update public.gh_acessos set leitura='todos',edicao='nenhum',criar=false where usuario_id=current_setting('gh.test.a')::uuid and modulo='producao';
set local role authenticated;
do $$declare n integer;blocked boolean:=false;begin
 if (select count(*) from public.gh_pedidos where criado_por in(current_setting('gh.test.a')::uuid,current_setting('gh.test.b')::uuid,current_setting('gh.test.c')::uuid))<>3 then raise exception 'FAIL selected-house read';end if;
 update public.gh_pedidos set dados='{"teste":"correcao autorizada"}' where unidade_codigo='G2' and criado_por=current_setting('gh.test.c')::uuid;get diagnostics n=row_count;if n<>1 then raise exception 'FAIL selected-house edit';end if;
 if (select count(*) from public.gh_operacao_central where modulo='producao' and criado_por in(current_setting('gh.test.a')::uuid,current_setting('gh.test.b')::uuid))<>2 then raise exception 'FAIL sector read';end if;
 update public.gh_operacao_central set dados='{}' where modulo='producao';get diagnostics n=row_count;if n<>0 then raise exception 'FAIL read-only production';end if;
 begin insert into public.gh_operacao_central(modulo,data_referencia,dados) values('producao',current_date,'{}');exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'FAIL read-only create';end if;
end;$$;
reset role;
-- Revocation applies with the very same JWT/session, without waiting for expiration.
update public.gh_perfis set ativo=false where usuario_id=current_setting('gh.test.a')::uuid;
set local role authenticated;
do $$begin if exists(select 1 from public.gh_pedidos) or exists(select 1 from public.gh_operacao_central) or exists(select 1 from public.gh_documentos) then raise exception 'FAIL disabled account';end if;end;$$;
reset role;
-- Transactional management, protected admin and optimistic revisions.
select public.gh_configurar_usuario(current_setting('gh.test.admin')::uuid,current_setting('gh.test.b')::uuid,'Operador','G1',true,'[{"modulo":"salgados","leitura":"proprios","edicao":"proprios","criar":true,"unidades":[]}]',1);
select set_config('request.jwt.claim.sub',current_setting('gh.test.b'),true);
set local role authenticated;
do $$begin if exists(select 1 from public.gh_pedidos) then raise exception 'FAIL configured user got legacy fallback';end if;end;$$;
reset role;
do $$declare blocked boolean:=false;begin
 begin perform public.gh_configurar_usuario(current_setting('gh.test.admin')::uuid,current_setting('gh.test.b')::uuid,'Operador','G1',true,'[]',1);exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL stale access revision';end if;
 if (select count(*) from public.gh_usuarios_auditoria where usuario_id=current_setting('gh.test.b')::uuid)<>1 then raise exception 'FAIL access audit';end if;
end;$$;
select 'PASS: own records, same-house view-only, selected-house edits, production/salgados, personal drafts, no self escalation, disabled account, access audit, revision conflict' as resultado;
rollback;
