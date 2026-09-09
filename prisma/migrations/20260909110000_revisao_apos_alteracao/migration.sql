-- AlterTable
ALTER TABLE "trade_participants" ADD COLUMN     "review_requested_at" TIMESTAMPTZ(6);

-- Quem esta esperando revisao nao esta confirmado.
--
-- Sao os dois lados do mesmo fato: a alteracao revogou a confirmacao e pediu
-- revisao. Se um dia divergirem, a tela mostraria "confirmado" e "revise"
-- ao mesmo tempo, e nenhuma das duas seria confiavel.
ALTER TABLE "trade_participants"
  ADD CONSTRAINT "trade_participants_review_excludes_confirmation"
  CHECK ("review_requested_at" IS NULL OR "confirmed_at" IS NULL);
