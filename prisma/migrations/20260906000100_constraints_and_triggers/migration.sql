-- Integridade que o schema do Prisma nao expressa.
--
-- Restricoes CHECK e triggers ficam aqui, em SQL bruto. O Prisma nao modela
-- nenhum desses objetos e por isso nao tenta remove-los.
--
-- A extensao pg_trgm e o indice de trigrama NAO estao aqui: sao declarados no
-- schema.prisma. O Prisma gerencia indices, e geraria um DROP INDEX na proxima
-- migration para qualquer indice que desconhecesse.
--
-- Ver docs/database.md secao 3 para o racional de cada trigger.

-- ------------------------------------------------------- vocabulario fechado

ALTER TABLE "users"
  ADD CONSTRAINT "users_plan_check"
  CHECK ("plan" IN ('FREE', 'PREMIUM'));

ALTER TABLE "cards"
  ADD CONSTRAINT "cards_type_check"
  CHECK ("type" IN ('Leader', 'Character', 'Event', 'Stage'));

ALTER TABLE "trades"
  ADD CONSTRAINT "trades_status_check"
  CHECK ("status" IN ('DRAFT', 'PROPOSED', 'NEGOTIATING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'));

-- completed_at e a origem do valor historico de um trade. Se ele divergir do
-- status, o valor historico passa a ser irresolvivel.
ALTER TABLE "trades"
  ADD CONSTRAINT "trades_completed_at_matches_status_check"
  CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL));

-- --------------------------------------------------- tipo e proposito de storage

-- BINDER e BOX servem a COLLECTION ou a TRADE. DECK nunca tem proposito.
-- Uma box de troca e valida: esta e a regra, nao uma excecao.
--
-- O COALESCE nao e enfeite. "purpose" aceita nulo, e NULL IN (...) resulta em
-- NULL, nao em FALSE. Um CHECK so reprova quando a expressao da FALSE: com
-- NULL ele aprova. Sem o COALESCE, um BINDER sem proposito passaria.
ALTER TABLE "storage_locations"
  ADD CONSTRAINT "storage_locations_type_purpose_check"
  CHECK (
    ("type" = 'DECK' AND "purpose" IS NULL)
    OR
    ("type" IN ('BINDER', 'BOX') AND COALESCE("purpose", '') IN ('COLLECTION', 'TRADE'))
  );

-- ------------------------------------------------------------------ quantidades

-- Quantidade zero e representada pela ausencia da linha, o que mantem a
-- contagem de cartas unicas como uma simples contagem de linhas.
ALTER TABLE "collection_items"
  ADD CONSTRAINT "collection_items_quantity_positive_check"
  CHECK ("quantity" > 0);

ALTER TABLE "collection_item_locations"
  ADD CONSTRAINT "collection_item_locations_quantity_positive_check"
  CHECK ("quantity" > 0);

ALTER TABLE "want_items"
  ADD CONSTRAINT "want_items_quantity_positive_check"
  CHECK ("quantity" > 0);

ALTER TABLE "trade_items"
  ADD CONSTRAINT "trade_items_quantity_positive_check"
  CHECK ("quantity" > 0);

ALTER TABLE "card_prices"
  ADD CONSTRAINT "card_prices_value_non_negative_check"
  CHECK ("value" >= 0);

-- ============================================================================
-- Trigger 1: a soma das alocacoes nunca excede a quantidade possuida
--
-- SUM(collection_item_locations.quantity) <= collection_items.quantity e um
-- agregado entre linhas, que um CHECK nao consegue avaliar.
--
-- O SELECT ... FOR UPDATE na linha pai e o que torna isto seguro sob
-- concorrencia: duas transacoes que alocam o mesmo item sao serializadas, entao
-- a segunda enxerga a soma ja gravada pela primeira em vez de uma leitura
-- desatualizada.
-- ============================================================================

CREATE OR REPLACE FUNCTION "check_allocation_within_owned_quantity"()
RETURNS TRIGGER AS $fn$
DECLARE
  v_item_id   BIGINT;
  v_owned     INTEGER;
  v_allocated INTEGER;
BEGIN
  v_item_id := NEW."collection_item_id";

  SELECT "quantity" INTO v_owned
  FROM "collection_items"
  WHERE "id" = v_item_id
  FOR UPDATE;

  SELECT COALESCE(SUM("quantity"), 0) INTO v_allocated
  FROM "collection_item_locations"
  WHERE "collection_item_id" = v_item_id;

  IF v_allocated > v_owned THEN
    RAISE EXCEPTION
      'allocated quantity (%) exceeds owned quantity (%) for collection_item %',
      v_allocated, v_owned, v_item_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

-- AFTER, para que a linha recem gravada entre na soma.
CREATE TRIGGER "collection_item_locations_within_owned_quantity"
AFTER INSERT OR UPDATE OF "quantity", "collection_item_id"
ON "collection_item_locations"
FOR EACH ROW
EXECUTE FUNCTION "check_allocation_within_owned_quantity"();

-- ============================================================================
-- Trigger 2: reduzir a quantidade possuida nunca deixa alocacao orfa
--
-- A API devolve um conflito estruturado para o usuario resolver (decisao 007).
-- Este trigger e a rede de seguranca no banco: nenhuma alocacao vira invalida
-- por baixo dos panos, qualquer que seja o caminho de escrita.
-- ============================================================================

CREATE OR REPLACE FUNCTION "check_owned_quantity_covers_allocations"()
RETURNS TRIGGER AS $fn$
DECLARE
  v_allocated INTEGER;
BEGIN
  IF NEW."quantity" >= OLD."quantity" THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM("quantity"), 0) INTO v_allocated
  FROM "collection_item_locations"
  WHERE "collection_item_id" = NEW."id";

  IF v_allocated > NEW."quantity" THEN
    RAISE EXCEPTION
      'cannot reduce quantity to % for collection_item %: % copies are still allocated',
      NEW."quantity", NEW."id", v_allocated
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER "collection_items_quantity_covers_allocations"
BEFORE UPDATE OF "quantity"
ON "collection_items"
FOR EACH ROW
EXECUTE FUNCTION "check_owned_quantity_covers_allocations"();

-- ============================================================================
-- Trigger 3: o armazenamento pertence ao dono da colecao
--
-- A relacao atravessa tres tabelas, entao nenhuma chave estrangeira simples a
-- expressa. Expressa-la declarativamente exigiria denormalizar user_id em
-- collection_items, o que alteraria o modelo aprovado.
-- ============================================================================

CREATE OR REPLACE FUNCTION "check_storage_belongs_to_collection_owner"()
RETURNS TRIGGER AS $fn$
DECLARE
  v_collection_owner BIGINT;
  v_storage_owner    BIGINT;
BEGIN
  SELECT c."user_id" INTO v_collection_owner
  FROM "collection_items" ci
  JOIN "collections" c ON c."id" = ci."collection_id"
  WHERE ci."id" = NEW."collection_item_id";

  SELECT "user_id" INTO v_storage_owner
  FROM "storage_locations"
  WHERE "id" = NEW."storage_location_id";

  IF v_collection_owner IS DISTINCT FROM v_storage_owner THEN
    RAISE EXCEPTION
      'storage_location % belongs to user %, but collection_item % belongs to user %',
      NEW."storage_location_id", v_storage_owner,
      NEW."collection_item_id", v_collection_owner
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER "collection_item_locations_same_owner"
BEFORE INSERT OR UPDATE OF "collection_item_id", "storage_location_id"
ON "collection_item_locations"
FOR EACH ROW
EXECUTE FUNCTION "check_storage_belongs_to_collection_owner"();
