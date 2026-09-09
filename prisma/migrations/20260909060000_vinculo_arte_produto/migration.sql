-- CreateTable
CREATE TABLE "variant_source_products" (
    "id" BIGSERIAL NOT NULL,
    "card_variant_id" BIGINT NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "source_product_id" VARCHAR(60) NOT NULL,
    "origin" VARCHAR(20) NOT NULL,
    "confirmed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variant_source_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "variant_source_products_card_variant_id_source_key" ON "variant_source_products"("card_variant_id", "source");

-- CreateIndex
CREATE UNIQUE INDEX "variant_source_products_source_source_product_id_key" ON "variant_source_products"("source", "source_product_id");

-- AddForeignKey
ALTER TABLE "variant_source_products" ADD CONSTRAINT "variant_source_products_card_variant_id_fkey" FOREIGN KEY ("card_variant_id") REFERENCES "card_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A origem do vinculo, no padrao do projeto: VARCHAR + CHECK em vez de enum
-- nativo. So dois valores, e a diferenca entre eles e o que protege o trabalho
-- manual de ser apagado por uma rederivacao.
ALTER TABLE "variant_source_products"
  ADD CONSTRAINT "variant_source_products_origin_valido"
  CHECK ("origin" IN ('automatic', 'manual'));
