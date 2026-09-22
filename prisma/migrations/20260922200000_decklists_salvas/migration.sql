-- Decklists salvas (decisao 108, que muda a 095).
--
-- Ate 22/09 o ColeXa nao guardava decks — "o ColeXa confere decks; guarda-los e
-- outro produto". Usuarios pediram guardar, para montar aos poucos e acompanhar
-- quanto falta, e o dono do produto inverteu a escolha de escopo.
--
-- `leader_variant_id` e NOT NULL: o lider ja era a primeira escolha do builder,
-- define as cores que o resto pode ter, e agora e a **capa** da lista. A capa
-- nao e coluna — sai da arte do lider. "Incompleto" tambem nao e: e a soma das
-- copias abaixo de 50.

CREATE TABLE "decks" (
    "id"                BIGSERIAL     PRIMARY KEY,
    "user_id"           BIGINT        NOT NULL,
    "name"              VARCHAR(100)  NOT NULL,
    "leader_variant_id" BIGINT        NOT NULL,
    "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "decks_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    -- RESTRICT como em collection_items: o catalogo nao apaga carta que alguem
    -- esta usando.
    CONSTRAINT "decks_leader_variant_id_fkey"
        FOREIGN KEY ("leader_variant_id") REFERENCES "card_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    -- Nome vazio nao guia ninguem, que e a unica funcao dele.
    CONSTRAINT "decks_name_nao_vazio" CHECK (btrim("name") <> '')
);

CREATE INDEX "decks_user_id_idx" ON "decks"("user_id");
CREATE INDEX "decks_leader_variant_id_idx" ON "decks"("leader_variant_id");

CREATE TABLE "deck_items" (
    "deck_id"         BIGINT NOT NULL,
    "card_variant_id" BIGINT NOT NULL,
    "copies"          INTEGER NOT NULL,

    -- Chave composta, sem id proprio: uma variante aparece uma vez por deck.
    -- Duas linhas da mesma arte no mesmo deck seriam a mesma afirmacao escrita
    -- duas vezes, e a soma dependeria de ninguem esquecer nenhuma.
    PRIMARY KEY ("deck_id", "card_variant_id"),

    CONSTRAINT "deck_items_deck_id_fkey"
        FOREIGN KEY ("deck_id") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "deck_items_card_variant_id_fkey"
        FOREIGN KEY ("card_variant_id") REFERENCES "card_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    -- A regra oficial: no maximo 4 copias da mesma carta (regra 7). O banco
    -- garante o teto por arte; somar as artes da mesma carta e do caso de uso,
    -- porque exige conhecer o catalogo.
    CONSTRAINT "deck_items_copias_validas" CHECK ("copies" > 0 AND "copies" <= 4)
);

CREATE INDEX "deck_items_card_variant_id_idx" ON "deck_items"("card_variant_id");
