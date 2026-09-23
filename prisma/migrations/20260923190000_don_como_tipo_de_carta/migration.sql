-- O DON!! vira um tipo de carta (decisao 112).
--
-- A restricao listava os quatro tipos que a Bandai publica. O DON!! nao esta no
-- catalogo oficial — conferido em 23/09, inclusive pela busca do proprio site —
-- e entra pelo tcgcsv, que rotula o tipo. Sem alargar esta restricao, a
-- importacao dele falha no banco.
--
-- Escrita a mao, e nao gerada: o Prisma nao modela CHECK, entao ele nao
-- produziria esta migration nem perceberia a divergencia.
ALTER TABLE "cards" DROP CONSTRAINT "cards_type_check";

ALTER TABLE "cards"
  ADD CONSTRAINT "cards_type_check"
  CHECK ("type" IN ('Leader', 'Character', 'Event', 'Stage', 'DON'));
