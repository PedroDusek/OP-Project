-- Reimpressao deixa de ser variante e vira impressao (decisao 052).
--
-- A fonte marca arte paralela com `_pN` e reimpressao com `_rN`. O importador
-- gravava as duas como `variant_type = 'Parallel'`, entao 412 linhas diziam que
-- a carta tinha uma arte a mais do que tem. O unico dado que a reimpressao
-- acrescenta e o set, e para isso ja existe `variant_printings`.
--
-- Medido antes de escrever esta migration: as 412 tem uma variante Normal na
-- mesma carta, nenhuma com raridade diferente da Normal, e 406 das impressoes
-- delas apontam para um set que a Normal ainda nao tem.

-- 1. As impressoes passam para a arte reimpressa.
--
-- `ON CONFLICT DO NOTHING` porque 5 delas apontam para um set que a Normal ja
-- conhece: a reimpressao saiu no mesmo produto que a original.
INSERT INTO "variant_printings" ("card_variant_id", "set_id")
SELECT normal."id", vp."set_id"
FROM "variant_printings" vp
JOIN "card_variants" reimpressao ON reimpressao."id" = vp."card_variant_id"
JOIN "card_variants" normal
  ON normal."card_id" = reimpressao."card_id"
 AND normal."variant_type" = 'Normal'
WHERE reimpressao."source_id" ~ '_r[0-9]+$'
ON CONFLICT ("card_variant_id", "set_id") DO NOTHING;

-- 2. Falhar alto se alguem tiver registrado uma reimpressao.
--
-- Hoje nao ha nenhuma: conferido em collection_items, want_items, trade_items e
-- card_prices, no banco local e em producao. As chaves estrangeiras sao
-- RESTRICT e ja barrariam o DELETE, mas com uma mensagem sobre constraint em
-- vez de sobre o problema. Se isto disparar, a resposta certa nao e forcar o
-- delete: e somar as quantidades na variante Normal, e essa logica precisa ser
-- escrita com cuidado sobre o unico (collection_id, card_variant_id).
DO $$
DECLARE
  presas bigint;
BEGIN
  SELECT count(*) INTO presas
  FROM "card_variants" v
  WHERE v."source_id" ~ '_r[0-9]+$'
    AND (
      EXISTS (SELECT 1 FROM "collection_items" ci WHERE ci."card_variant_id" = v."id")
      OR EXISTS (SELECT 1 FROM "want_items" wi WHERE wi."card_variant_id" = v."id")
      OR EXISTS (SELECT 1 FROM "trade_items" ti WHERE ti."card_variant_id" = v."id")
      OR EXISTS (SELECT 1 FROM "card_prices" cp WHERE cp."card_variant_id" = v."id")
    );

  IF presas > 0 THEN
    RAISE EXCEPTION
      'Ha % reimpressoes com dado associado (colecao, want, trade ou preco). Migrar exige somar as quantidades na variante Normal, e isso nao esta escrito. Ver decisao 052.', presas;
  END IF;
END $$;

-- 3. As impressoes das reimpressoes, agora duplicadas na Normal, saem.
DELETE FROM "variant_printings" vp
USING "card_variants" v
WHERE v."id" = vp."card_variant_id"
  AND v."source_id" ~ '_r[0-9]+$';

-- 4. E as linhas de variante somem.
DELETE FROM "card_variants" WHERE "source_id" ~ '_r[0-9]+$';
