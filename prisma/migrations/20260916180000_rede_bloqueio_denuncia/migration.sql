-- A rede: bloquear e denunciar (regra 6.1.4, decisao 079).
--
-- Duas tabelas novas, aprovadas pelo dono do produto em 16/09. O bloqueio e numa
-- direcao so, como a regra diz; a denuncia e guardada para ele ler numa tela de
-- administrador, porque o SMTP proprio ainda nao existe.

-- CreateTable
CREATE TABLE "user_blocks" (
    "id" BIGSERIAL NOT NULL,
    "blocker_id" BIGINT NOT NULL,
    "blocked_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reports" (
    "id" BIGSERIAL NOT NULL,
    "reporter_id" BIGINT NOT NULL,
    "reported_id" BIGINT NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_blocks_blocked_id_idx" ON "user_blocks"("blocked_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_blocks_blocker_id_blocked_id_key" ON "user_blocks"("blocker_id", "blocked_id");

-- CreateIndex
CREATE INDEX "user_reports_reported_id_idx" ON "user_reports"("reported_id");

-- CreateIndex
CREATE INDEX "user_reports_created_at_idx" ON "user_reports"("created_at");

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_id_fkey" FOREIGN KEY ("reported_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------- invariantes
--
-- Escrito a mao: CHECK o Prisma nao sabe expressar (armadilha 1).

-- Ninguem bloqueia nem denuncia a si mesmo. A tela nao oferece o gesto, e isto
-- e o que segura um formulario montado a mao.
ALTER TABLE "user_blocks"
  ADD CONSTRAINT "user_blocks_not_self" CHECK ("blocker_id" <> "blocked_id");

ALTER TABLE "user_reports"
  ADD CONSTRAINT "user_reports_not_self" CHECK ("reporter_id" <> "reported_id");

-- Denuncia sem motivo nao diz nada a quem vai ler.
ALTER TABLE "user_reports"
  ADD CONSTRAINT "user_reports_reason_not_blank" CHECK (length(btrim("reason")) > 0);
