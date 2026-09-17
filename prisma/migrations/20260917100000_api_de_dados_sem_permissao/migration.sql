-- A API de dados do Supabase sem nenhuma permissao nas nossas tabelas (decisao 085).
--
-- O ColeXa nao usa a API de dados do Supabase: o navegador fala com o servidor do
-- ColeXa, e so o servidor fala com o banco. Mesmo assim, todo projeto Supabase
-- expoe o schema `public` a chave publica — que vai no site — pelos papeis `anon`
-- (visitante) e `authenticated` (usuario logado).
--
-- Conferido em producao em 17/09: as 34 tabelas ja tinham RLS ligado, e os dois
-- papeis nao podiam ler, inserir, alterar nem apagar. Sobravam TRUNCATE,
-- REFERENCES e TRIGGER, concedidos pela regra padrao do `postgres` a toda tabela
-- nova. A API nao oferece caminho para usa-los, mas permissao que nao serve a
-- nada e so superficie. Aprovado pelo dono do produto.
--
-- Os papeis so existem no Supabase: no banco local e na CI esta migration nao faz
-- nada. `service_role` fica como esta — e a chave secreta do servidor, usada no
-- Storage.

DO $$
DECLARE
  papel text;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', papel);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', papel);
      -- A regra padrao: sem isto, a proxima tabela criada voltaria a conceder.
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', papel);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', papel);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', papel);
    END IF;
  END LOOP;
END
$$;
