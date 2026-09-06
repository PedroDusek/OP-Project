-- DropIndex
DROP INDEX "card_prices_card_variant_id_captured_at_idx";

-- CreateIndex
CREATE UNIQUE INDEX "card_prices_card_variant_id_captured_at_key" ON "card_prices"("card_variant_id", "captured_at");
