-- Run manually if you prefer SQL over `npx prisma migrate dev`.
-- Matches Notification model in schema.prisma (do not run if already migrated).

CREATE TYPE "NotificationType" AS ENUM (
  'AUDIT_COMPLETED',
  'AUDIT_FAILED',
  'HIGH_EXCEPTION_COUNT',
  'SESSION_EXPIRING_SOON',
  'MISSING_PREREQUISITE'
);

CREATE TABLE "notifications" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "message" TEXT NOT NULL,
  "action_url" VARCHAR(255),
  "metadata" JSONB,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
