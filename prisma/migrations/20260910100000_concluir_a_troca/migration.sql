-- AlterTable
ALTER TABLE "trade_participants" ADD COLUMN     "exchanged_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "trade_item_origins" (
    "id" BIGSERIAL NOT NULL,
    "trade_item_id" BIGINT NOT NULL,
    "storage_location_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "trade_item_origins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trade_item_origins_storage_location_id_idx" ON "trade_item_origins"("storage_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "trade_item_origins_trade_item_id_storage_location_id_key" ON "trade_item_origins"("trade_item_id", "storage_location_id");

-- AddForeignKey
ALTER TABLE "trade_item_origins" ADD CONSTRAINT "trade_item_origins_trade_item_id_fkey" FOREIGN KEY ("trade_item_id") REFERENCES "trade_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_item_origins" ADD CONSTRAINT "trade_item_origins_storage_location_id_fkey" FOREIGN KEY ("storage_location_id") REFERENCES "storage_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------- invariantes
--
-- Daqui para baixo e escrito a mao: CHECK o Prisma nao sabe expressar, e um
-- indice escrito aqui viraria DROP INDEX na proxima migration (armadilha 1).

-- Zero copias saindo de um local nao e uma origem, e a ausencia da linha ja diz
-- isso. O mesmo criterio das outras tabelas de quantidade.
ALTER TABLE "trade_item_origins"
  ADD CONSTRAINT "trade_item_origins_quantity_positive_check"
  CHECK ("quantity" > 0);

-- Nao se marca como trocada uma troca que nao foi confirmada.
--
-- Marcar diz "as cartas mudaram de dono"; confirmar diz "concordo com esta
-- troca". A segunda precede a primeira, e qualquer alteracao derruba as duas
-- (regra 4.6.3 estendida a marcacao pela decisao 062). Sem este CHECK, uma
-- alteracao que esquecesse de limpar a marcacao deixaria uma troca marcada como
-- feita e nao confirmada — e ela concluiria sozinha na proxima confirmacao.
--
-- `IS NULL` e `IS NOT NULL` nunca devolvem NULL, entao este CHECK nao precisa do
-- COALESCE da armadilha 2.
ALTER TABLE "trade_participants"
  ADD CONSTRAINT "trade_participants_exchange_requires_confirmation"
  CHECK ("exchanged_at" IS NULL OR "confirmed_at" IS NOT NULL);
