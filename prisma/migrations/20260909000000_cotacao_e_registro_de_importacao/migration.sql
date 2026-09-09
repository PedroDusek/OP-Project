-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" BIGSERIAL NOT NULL,
    "base_currency" VARCHAR(3) NOT NULL,
    "quote_currency" VARCHAR(3) NOT NULL,
    "quote_date" DATE NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_imports" (
    "id" BIGSERIAL NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "source_updated_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "matched" INTEGER NOT NULL DEFAULT 0,
    "written" INTEGER NOT NULL DEFAULT 0,
    "unchanged" INTEGER NOT NULL DEFAULT 0,
    "unknown_codes" INTEGER NOT NULL DEFAULT 0,
    "failure" VARCHAR(500),

    CONSTRAINT "price_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_base_currency_quote_currency_quote_date_key" ON "exchange_rates"("base_currency", "quote_currency", "quote_date");

-- CreateIndex
CREATE INDEX "price_imports_finished_at_idx" ON "price_imports"("finished_at");

-- Cotacao nao negativa. Fonte que devolve zero ou negativo esta quebrada, e o
-- valor em real derivado dela seria pior que a ausencia do valor em real.
ALTER TABLE "exchange_rates"
  ADD CONSTRAINT "exchange_rates_rate_positive" CHECK ("rate" > 0);

-- Uma execucao nao termina antes de comecar. Sem isto, uma inversao passaria
-- despercebida e "atualizado ha X" viraria numero negativo na tela.
ALTER TABLE "price_imports"
  ADD CONSTRAINT "price_imports_finished_after_started"
  CHECK ("finished_at" IS NULL OR "finished_at" >= "started_at");
