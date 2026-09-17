-- O pedido de exclusao de conta, com 30 dias para desistir (decisao 091).

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletion_requested_at" TIMESTAMPTZ(6);

-- Conta anonimizada nao tem pedido pendente: a anonimizacao limpa o pedido.
-- Sem esta trava, uma conta ja anonimizada poderia voltar a lista da tarefa
-- diaria e ser "excluida" de novo.
ALTER TABLE "users"
  ADD CONSTRAINT "users_exclusao_anonimizada_sem_pedido"
  CHECK ("deleted_at" IS NULL OR "deletion_requested_at" IS NULL);
