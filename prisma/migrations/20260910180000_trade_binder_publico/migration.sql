-- O Trade Binder publico passa a ser do usuario, e nao do local (decisao 064).
--
-- O que se publica e o **conjunto**: todas as copias em locais de troca aparecem
-- como uma colecao so. A divisao entre binder e caixa e organizacao domestica de
-- quem guarda, e nao diz nada a quem olha de fora procurando uma carta.
--
-- Isto **altera a decisao 008**, que guardava o token em `storage_locations`.
-- Aquelas colunas nunca chegaram a ser usadas por linha nenhuma de codigo, e
-- saem aqui: coluna morta que uma decisao descreve e pior que coluna nenhuma,
-- porque quem le a decisao acredita nela.

-- DropIndex
DROP INDEX "storage_locations_public_token_key";

-- AlterTable
ALTER TABLE "storage_locations" DROP COLUMN "public_token",
DROP COLUMN "public_token_created_at";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "trade_binder_token" VARCHAR(64),
ADD COLUMN     "trade_binder_token_created_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "users_trade_binder_token_key" ON "users"("trade_binder_token");

-- ---------------------------------------------------------------- invariantes
--
-- Escrito a mao: CHECK o Prisma nao sabe expressar (armadilha 1).

-- Token e data andam juntos.
--
-- Sao os dois lados do mesmo fato: publicar grava os dois, revogar apaga os
-- dois. Se divergirem, a tela mostraria "publicado em <nada>" ou uma data de
-- publicacao sem link — e nenhuma das duas seria verdade.
ALTER TABLE "users"
  ADD CONSTRAINT "users_trade_binder_token_with_date"
  CHECK (
    ("trade_binder_token" IS NULL) = ("trade_binder_token_created_at" IS NULL)
  );
