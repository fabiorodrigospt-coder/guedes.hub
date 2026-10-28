begin;
select set_config('gh.test.admin',(select usuario_id::text from public.gh_perfis where perfil='administrador' and ativo limit 1),true),set_config('gh.test.user',gen_random_uuid()::text,true),set_config('gh.test.other',gen_random_uuid()::text,true);
insert into auth.users(id,email,aud,role) values(current_setting('gh.test.user')::uuid,'gh-login-test@example.invalid','authenticated','authenticated'),(current_setting('gh.test.other')::uuid,'gh-login-other@example.invalid','authenticated','authenticated');
select public.gh_configurar_usuario_login(current_setting('gh.test.admin')::uuid,current_setting('gh.test.user')::uuid,'Guedes teste','G2',true,'[{"modulo":"pedidos","leitura":"proprios","edicao":"proprios","criar":true,"unidades":[]}]',null,'GuedesTesteSQL');
do $$declare n integer;blocked boolean:=false;begin
 if public.gh_resolver_login('gUEDEStESTEsQL')->>'usuario_id'<>current_setting('gh.test.user') then raise exception 'FAIL case insensitive login';end if;
 begin perform public.gh_configurar_usuario_login(current_setting('gh.test.admin')::uuid,current_setting('gh.test.other')::uuid,'Duplicado','G2',true,'[{"modulo":"pedidos","leitura":"proprios","edicao":"proprios","criar":true,"unidades":[]}]',null,'guedestestesql');exception when unique_violation then blocked:=true;end;
 if not blocked or exists(select 1 from public.gh_perfis where usuario_id=current_setting('gh.test.other')::uuid) then raise exception 'FAIL unique login or rollback';end if;
 for n in 1..10 loop if not public.gh_limite_login(repeat('a',64)) then raise exception 'FAIL rate limit before threshold';end if;end loop;
 if public.gh_limite_login(repeat('a',64)) then raise exception 'FAIL rate limit not enforced';end if;
 perform public.gh_limpar_limite_login(repeat('a',64));if not public.gh_limite_login(repeat('a',64)) then raise exception 'FAIL reset limit';end if;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('gh.test.user'),true);
set local role authenticated;
insert into public.gh_pedidos(unidade_codigo,criado_por,dados) values('G2',auth.uid(),'{"teste_login":true}');
do $$declare blocked boolean:=false;begin
 begin perform public.gh_resolver_login('GuedesTesteSQL');exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'FAIL user can enumerate login emails';end if;
 blocked:=false;begin perform public.gh_excluir_usuario(auth.uid(),auth.uid(),1);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'FAIL self account deletion RPC';end if;
end;$$;
reset role;
select public.gh_excluir_usuario(current_setting('gh.test.admin')::uuid,current_setting('gh.test.user')::uuid,1);
do $$declare blocked boolean:=false;begin
 if public.gh_resolver_login('GuedesTesteSQL') is not null then raise exception 'FAIL deleted account can login';end if;
 if not exists(select 1 from public.gh_pedidos where criado_por=current_setting('gh.test.user')::uuid) then raise exception 'FAIL deleted user lost order';end if;
 begin perform public.gh_excluir_usuario(current_setting('gh.test.admin')::uuid,current_setting('gh.test.admin')::uuid,1);exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL protected admin';end if;
end;$$;
set local role authenticated;
do $$begin if exists(select 1 from public.gh_pedidos) then raise exception 'FAIL revoked session after delete';end if;end;$$;
reset role;
select public.gh_configurar_usuario_login(current_setting('gh.test.admin')::uuid,current_setting('gh.test.user')::uuid,'Restaurado','G2',true,'[{"modulo":"pedidos","leitura":"proprios","edicao":"proprios","criar":true,"unidades":[]}]',2,'GuedesTesteSQL');
do $$begin if public.gh_resolver_login('guedestestesql') is null then raise exception 'FAIL restore login';end if;end;$$;
select 'PASS: username uniqueness/case folding, private email resolution, login throttling, archive preserves records, revoked session, protected admin and restore' as resultado;
rollback;
