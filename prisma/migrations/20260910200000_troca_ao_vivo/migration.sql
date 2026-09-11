-- Quando a oferta mudou pela ultima vez (decisao 065).
--
-- E daqui que sai a espera de cinco segundos antes de poder confirmar: a trava
-- classica das trocas de jogo, que da tempo de ver o que o outro acabou de mexer
-- antes de dizer que esta pronto.
--
-- Nao reaproveita `updated_at` porque ele sobe tambem ao confirmar, e a
-- contagem reiniciaria no gesto errado. Nem sai dos itens, porque **tirar** uma
-- carta e uma alteracao e a linha desaparece junto com a data.

-- AlterTable
ALTER TABLE "trades" ADD COLUMN     "offer_changed_at" TIMESTAMPTZ(6);
