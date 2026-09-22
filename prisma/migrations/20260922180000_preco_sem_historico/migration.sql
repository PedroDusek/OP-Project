-- Preco passa a ser sobrescrito: uma linha por variante (decisao 107).
--
-- O historico existia para a regra 5.1 — o valor de um trade concluido pelo
-- preco vigente na data. Ela nunca foi implementada, e o dono do produto
-- decidiu em 22/09 que o produto nao guardara valor de carta em troca nenhuma.
-- Nenhuma consulta do sistema le preco de data passada: dashboard, analise de
-- deck e leitura de preco pegam todas a linha mais recente.
--
-- Guardar uma serie que ninguem le custaria ~1 GB por ano quando Pokemon
-- entrar (decisao 106), e o plano gratuito do Supabase trava em 500 MB com o
-- projeto em modo somente leitura.
--
-- **Esta migration apaga dados e nao tem volta.** Era o momento mais barato da
-- vida do produto para faze-lo: 13 dias de historico e zero trades concluidos.

-- 1. Fica so a captura mais recente de cada variante. `ctid` e a identidade
--    fisica da linha, e e o unico jeito de desempatar sem chave primaria util
--    quando duas capturas dividem o mesmo instante.
DELETE FROM card_prices a
      USING card_prices b
      WHERE a.card_variant_id = b.card_variant_id
        AND (a.captured_at < b.captured_at
             OR (a.captured_at = b.captured_at AND a.ctid < b.ctid));

-- 2. A chave antiga permitia varias linhas por variante; a nova e o que garante
--    que a importacao sobrescreva em vez de acumular.
DROP INDEX IF EXISTS "card_prices_card_variant_id_captured_at_key";

CREATE UNIQUE INDEX "card_prices_card_variant_id_key"
    ON card_prices (card_variant_id);
