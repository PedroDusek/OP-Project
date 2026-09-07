-- Descricao do local de armazenamento.
--
-- As telas 22 e 24 mostram o campo desde a especificacao; a coluna nao existia.
-- Acrescimo aprovado pelo dono do produto no Checkpoint 10.
--
-- Anulavel de proposito: local sem descricao e o caso comum, e uma string vazia
-- obrigatoria daria dois jeitos de dizer "nao tem".
--
-- 500 e o mesmo teto de "image", e cabe o paragrafo que a tela sugere sem virar
-- campo de texto livre sem fim.
ALTER TABLE "storage_locations"
  ADD COLUMN "description" VARCHAR(500);
