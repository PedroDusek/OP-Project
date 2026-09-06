-- AlterTable
ALTER TABLE "card_variants" ADD COLUMN     "source" VARCHAR(30),
ADD COLUMN     "source_id" VARCHAR(60);

-- CreateIndex
CREATE UNIQUE INDEX "card_variants_source_source_id_key" ON "card_variants"("source", "source_id");
