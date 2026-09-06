-- AlterTable
ALTER TABLE "users" DROP COLUMN "password_hash",
ADD COLUMN     "auth_user_id" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users"("auth_user_id");
