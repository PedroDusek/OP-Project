-- AlterTable
ALTER TABLE "users" ADD COLUMN     "username" VARCHAR(20),
ADD COLUMN     "username_changed_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- O nome e guardado ja normalizado (decisao 060).
--
-- A unicidade vale sobre a forma minuscula, e o CHECK garante que nada entre
-- fora dela — inclusive por caminho que nao passe pela aplicacao. Sem isto,
-- `Pedro` e `pedro` seriam duas contas que o olho nao distingue.
--
-- O formato completo mora no dominio, em `domain/social/username.ts`; aqui fica
-- so o que o banco consegue afirmar sozinho e que nao pode ser contornado.
ALTER TABLE "users"
  ADD CONSTRAINT "users_username_normalizado"
  CHECK ("username" IS NULL OR "username" = lower("username"));

-- Trocar exige ter um nome. Sem isto a coluna de data poderia contar uma troca
-- que nunca houve, e a espera de uma semana comecaria antes da primeira escolha.
ALTER TABLE "users"
  ADD CONSTRAINT "users_username_changed_requires_username"
  CHECK ("username_changed_at" IS NULL OR "username" IS NOT NULL);
