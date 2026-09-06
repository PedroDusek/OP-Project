-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "plan" VARCHAR(20) NOT NULL DEFAULT 'FREE',
    "trial_started_at" TIMESTAMPTZ(6),
    "premium_until" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "cost" INTEGER,
    "power" INTEGER,
    "life" INTEGER,
    "counter" INTEGER,
    "has_trigger" BOOLEAN NOT NULL DEFAULT false,
    "block_icon" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_variants" (
    "id" BIGSERIAL NOT NULL,
    "card_id" BIGINT NOT NULL,
    "variant_type" VARCHAR(50) NOT NULL,
    "rarity" VARCHAR(50),
    "image_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "card_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sets" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(150) NOT NULL,

    CONSTRAINT "sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_printings" (
    "card_variant_id" BIGINT NOT NULL,
    "set_id" BIGINT NOT NULL,

    CONSTRAINT "variant_printings_pkey" PRIMARY KEY ("card_variant_id","set_id")
);

-- CreateTable
CREATE TABLE "colors" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traits" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "traits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attributes" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mechanics" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "mechanics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "effects" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "effects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_colors" (
    "card_id" BIGINT NOT NULL,
    "color_id" BIGINT NOT NULL,

    CONSTRAINT "card_colors_pkey" PRIMARY KEY ("card_id","color_id")
);

-- CreateTable
CREATE TABLE "card_traits" (
    "card_id" BIGINT NOT NULL,
    "trait_id" BIGINT NOT NULL,

    CONSTRAINT "card_traits_pkey" PRIMARY KEY ("card_id","trait_id")
);

-- CreateTable
CREATE TABLE "card_attributes" (
    "card_id" BIGINT NOT NULL,
    "attribute_id" BIGINT NOT NULL,

    CONSTRAINT "card_attributes_pkey" PRIMARY KEY ("card_id","attribute_id")
);

-- CreateTable
CREATE TABLE "card_mechanics" (
    "card_id" BIGINT NOT NULL,
    "mechanic_id" BIGINT NOT NULL,

    CONSTRAINT "card_mechanics_pkey" PRIMARY KEY ("card_id","mechanic_id")
);

-- CreateTable
CREATE TABLE "card_effects" (
    "card_id" BIGINT NOT NULL,
    "effect_id" BIGINT NOT NULL,

    CONSTRAINT "card_effects_pkey" PRIMARY KEY ("card_id","effect_id")
);

-- CreateTable
CREATE TABLE "collection_items" (
    "id" BIGSERIAL NOT NULL,
    "collection_id" BIGINT NOT NULL,
    "card_variant_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_locations" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "image" VARCHAR(500),
    "type" VARCHAR(20) NOT NULL,
    "purpose" VARCHAR(20),
    "public_token" VARCHAR(64),
    "public_token_created_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "storage_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_item_locations" (
    "id" BIGSERIAL NOT NULL,
    "collection_item_id" BIGINT NOT NULL,
    "storage_location_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "collection_item_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "want_items" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "card_variant_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "want_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_prices" (
    "id" BIGSERIAL NOT NULL,
    "card_variant_id" BIGINT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "captured_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "card_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" BIGSERIAL NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_participants" (
    "id" BIGSERIAL NOT NULL,
    "trade_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "role" VARCHAR(30) NOT NULL,
    "confirmed_at" TIMESTAMPTZ(6),

    CONSTRAINT "trade_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_items" (
    "id" BIGSERIAL NOT NULL,
    "trade_participant_id" BIGINT NOT NULL,
    "card_variant_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "trade_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "collections_user_id_key" ON "collections"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cards_code_key" ON "cards"("code");

-- CreateIndex
CREATE INDEX "cards_name_idx" ON "cards" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "cards_type_idx" ON "cards"("type");

-- CreateIndex
CREATE INDEX "card_variants_card_id_idx" ON "card_variants"("card_id");

-- CreateIndex
CREATE INDEX "card_variants_rarity_idx" ON "card_variants"("rarity");

-- CreateIndex
CREATE INDEX "card_variants_variant_type_idx" ON "card_variants"("variant_type");

-- CreateIndex
CREATE UNIQUE INDEX "sets_code_key" ON "sets"("code");

-- CreateIndex
CREATE INDEX "variant_printings_set_id_idx" ON "variant_printings"("set_id");

-- CreateIndex
CREATE UNIQUE INDEX "colors_name_key" ON "colors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "traits_name_key" ON "traits"("name");

-- CreateIndex
CREATE UNIQUE INDEX "attributes_name_key" ON "attributes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "mechanics_name_key" ON "mechanics"("name");

-- CreateIndex
CREATE UNIQUE INDEX "effects_name_key" ON "effects"("name");

-- CreateIndex
CREATE INDEX "card_colors_color_id_idx" ON "card_colors"("color_id");

-- CreateIndex
CREATE INDEX "card_traits_trait_id_idx" ON "card_traits"("trait_id");

-- CreateIndex
CREATE INDEX "card_attributes_attribute_id_idx" ON "card_attributes"("attribute_id");

-- CreateIndex
CREATE INDEX "card_mechanics_mechanic_id_idx" ON "card_mechanics"("mechanic_id");

-- CreateIndex
CREATE INDEX "card_effects_effect_id_idx" ON "card_effects"("effect_id");

-- CreateIndex
CREATE INDEX "collection_items_card_variant_id_idx" ON "collection_items"("card_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_items_collection_id_card_variant_id_key" ON "collection_items"("collection_id", "card_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "storage_locations_public_token_key" ON "storage_locations"("public_token");

-- CreateIndex
CREATE INDEX "storage_locations_user_id_idx" ON "storage_locations"("user_id");

-- CreateIndex
CREATE INDEX "collection_item_locations_storage_location_id_idx" ON "collection_item_locations"("storage_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_item_locations_collection_item_id_storage_locati_key" ON "collection_item_locations"("collection_item_id", "storage_location_id");

-- CreateIndex
CREATE INDEX "want_items_card_variant_id_idx" ON "want_items"("card_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "want_items_user_id_card_variant_id_key" ON "want_items"("user_id", "card_variant_id");

-- CreateIndex
CREATE INDEX "card_prices_card_variant_id_captured_at_idx" ON "card_prices"("card_variant_id", "captured_at" DESC);

-- CreateIndex
CREATE INDEX "trades_status_idx" ON "trades"("status");

-- CreateIndex
CREATE INDEX "trade_participants_user_id_idx" ON "trade_participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trade_participants_trade_id_user_id_key" ON "trade_participants"("trade_id", "user_id");

-- CreateIndex
CREATE INDEX "trade_items_card_variant_id_idx" ON "trade_items"("card_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "trade_items_trade_participant_id_card_variant_id_key" ON "trade_items"("trade_participant_id", "card_variant_id");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_variants" ADD CONSTRAINT "card_variants_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_printings" ADD CONSTRAINT "variant_printings_card_variant_id_fkey" FOREIGN KEY ("card_variant_id") REFERENCES "card_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_printings" ADD CONSTRAINT "variant_printings_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_colors" ADD CONSTRAINT "card_colors_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_colors" ADD CONSTRAINT "card_colors_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_traits" ADD CONSTRAINT "card_traits_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_traits" ADD CONSTRAINT "card_traits_trait_id_fkey" FOREIGN KEY ("trait_id") REFERENCES "traits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_attributes" ADD CONSTRAINT "card_attributes_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_attributes" ADD CONSTRAINT "card_attributes_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_mechanics" ADD CONSTRAINT "card_mechanics_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_mechanics" ADD CONSTRAINT "card_mechanics_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "mechanics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_effects" ADD CONSTRAINT "card_effects_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_effects" ADD CONSTRAINT "card_effects_effect_id_fkey" FOREIGN KEY ("effect_id") REFERENCES "effects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_card_variant_id_fkey" FOREIGN KEY ("card_variant_id") REFERENCES "card_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_item_locations" ADD CONSTRAINT "collection_item_locations_collection_item_id_fkey" FOREIGN KEY ("collection_item_id") REFERENCES "collection_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_item_locations" ADD CONSTRAINT "collection_item_locations_storage_location_id_fkey" FOREIGN KEY ("storage_location_id") REFERENCES "storage_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "want_items" ADD CONSTRAINT "want_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "want_items" ADD CONSTRAINT "want_items_card_variant_id_fkey" FOREIGN KEY ("card_variant_id") REFERENCES "card_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_prices" ADD CONSTRAINT "card_prices_card_variant_id_fkey" FOREIGN KEY ("card_variant_id") REFERENCES "card_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_participants" ADD CONSTRAINT "trade_participants_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_participants" ADD CONSTRAINT "trade_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_trade_participant_id_fkey" FOREIGN KEY ("trade_participant_id") REFERENCES "trade_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_card_variant_id_fkey" FOREIGN KEY ("card_variant_id") REFERENCES "card_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
