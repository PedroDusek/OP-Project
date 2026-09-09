-- AlterTable
ALTER TABLE "trades" ADD COLUMN     "invite_token" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "trades_invite_token_key" ON "trades"("invite_token");

-- Os papeis de um participante (decisao 056).
--
-- O unico assimetrico no protocolo da regra 4.6.1 e quem iniciou: dali em
-- diante os dois fazem exatamente as mesmas coisas — ajustam a propria oferta e
-- confirmam. A coluna existia desde o modelo logico sem nenhum valor definido,
-- e sem CHECK qualquer string entraria.
ALTER TABLE "trade_participants"
  ADD CONSTRAINT "trade_participants_role_check"
  CHECK ("role" IN ('INITIATOR', 'RECIPIENT'));

-- O convite so faz sentido enquanto falta alguem entrar.
--
-- Depois que a segunda pessoa entra, o token e apagado: um link que continua
-- valendo e um link que ainda pode vazar, e a troca ja tem os dois lados que a
-- regra 4.5 permite.
ALTER TABLE "trades"
  ADD CONSTRAINT "trades_invite_token_only_while_draft"
  CHECK ("invite_token" IS NULL OR "status" = 'DRAFT');
