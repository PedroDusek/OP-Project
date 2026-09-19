-- CreateTable
CREATE TABLE "subscriptions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'stripe',
    "customer_id" VARCHAR(64) NOT NULL,
    "subscription_id" VARCHAR(64),
    "status" VARCHAR(20) NOT NULL,
    "cycle" VARCHAR(10) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "current_period_end" TIMESTAMPTZ(6),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" BIGSERIAL NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'stripe',
    "event_id" VARCHAR(80) NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "handled_at" TIMESTAMPTZ(6),
    "failure" VARCHAR(500),
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_subscription_id_key" ON "subscriptions"("subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_customer_id_idx" ON "subscriptions"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_event_id_key" ON "payment_events"("event_id");

-- CreateIndex
CREATE INDEX "payment_events_type_received_at_idx" ON "payment_events"("type", "received_at");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
