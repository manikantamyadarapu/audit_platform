/*
  Warnings:

  - You are about to drop the column `role_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `audit_issue_counts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `audit_performance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dashboard_audit_metrics` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dashboard_summary` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `gross_audit_summary` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `id_proof_audit_summary` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `password_reset_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rate_audit_summary` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `roles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `uploaded_files` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AUDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('PASSWORD_RESET', 'REFRESH');

-- DropForeignKey
ALTER TABLE "audit_issue_counts" DROP CONSTRAINT "audit_issue_counts_audit_run_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_performance" DROP CONSTRAINT "audit_performance_audit_run_id_fkey";

-- DropForeignKey
ALTER TABLE "dashboard_audit_metrics" DROP CONSTRAINT "dashboard_audit_metrics_audit_type_id_fkey";

-- DropForeignKey
ALTER TABLE "dashboard_audit_metrics" DROP CONSTRAINT "dashboard_audit_metrics_dashboard_summary_id_fkey";

-- DropForeignKey
ALTER TABLE "gross_audit_summary" DROP CONSTRAINT "gross_audit_summary_audit_run_id_fkey";

-- DropForeignKey
ALTER TABLE "id_proof_audit_summary" DROP CONSTRAINT "id_proof_audit_summary_audit_run_id_fkey";

-- DropForeignKey
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_user_id_fkey";

-- DropForeignKey
ALTER TABLE "rate_audit_summary" DROP CONSTRAINT "rate_audit_summary_audit_run_id_fkey";

-- DropForeignKey
ALTER TABLE "uploaded_files" DROP CONSTRAINT "uploaded_files_audit_run_id_fkey";

-- DropForeignKey
ALTER TABLE "uploaded_files" DROP CONSTRAINT "uploaded_files_uploaded_by_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_role_id_fkey";

-- DropIndex
DROP INDEX "users_role_id_idx";

-- AlterTable
ALTER TABLE "audit_runs" ADD COLUMN     "cpu_usage_percent" DECIMAL(5,2),
ADD COLUMN     "file_hash" VARCHAR(64),
ADD COLUMN     "file_size" BIGINT,
ADD COLUMN     "memory_usage_mb" DECIMAL(10,2),
ADD COLUMN     "original_name" VARCHAR(255),
ADD COLUMN     "processing_time_ms" INTEGER,
ADD COLUMN     "result_summary" JSONB,
ADD COLUMN     "rows_per_second" DECIMAL(10,2),
ADD COLUMN     "storage_path" VARCHAR(500);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'VIEWER';

-- Data migration: Preserve existing user roles before dropping role_id
UPDATE "users" 
SET "role" = CASE 
    WHEN (SELECT "role_name" FROM "roles" WHERE "id" = "users"."role_id") = 'ADMIN' THEN 'ADMIN'::UserRole
    WHEN (SELECT "role_name" FROM "roles" WHERE "id" = "users"."role_id") = 'AUDITOR' THEN 'AUDITOR'::UserRole
    WHEN (SELECT "role_name" FROM "roles" WHERE "id" = "users"."role_id") = 'VIEWER' THEN 'VIEWER'::UserRole
    ELSE 'VIEWER'::UserRole -- default fallback
END;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role_id";

-- DropTable
DROP TABLE "audit_issue_counts";

-- DropTable
DROP TABLE "audit_performance";

-- DropTable
DROP TABLE "dashboard_audit_metrics";

-- DropTable
DROP TABLE "dashboard_summary";

-- DropTable
DROP TABLE "gross_audit_summary";

-- DropTable
DROP TABLE "id_proof_audit_summary";

-- DropTable
DROP TABLE "password_reset_tokens";

-- DropTable
DROP TABLE "rate_audit_summary";

-- DropTable
DROP TABLE "roles";

-- DropTable
DROP TABLE "uploaded_files";

-- DropEnum
DROP TYPE "Severity";

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "type" "TokenType" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_snapshots" (
    "id" SERIAL NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "total_files_uploaded" INTEGER NOT NULL DEFAULT 0,
    "total_audits" INTEGER NOT NULL DEFAULT 0,
    "completed_audits" INTEGER NOT NULL DEFAULT 0,
    "failed_audits" INTEGER NOT NULL DEFAULT 0,
    "processing_audits" INTEGER NOT NULL DEFAULT 0,
    "total_rows_processed" INTEGER NOT NULL DEFAULT 0,
    "total_invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "total_users" INTEGER NOT NULL DEFAULT 0,
    "avg_processing_time_sec" DECIMAL(10,2),
    "success_rate" DECIMAL(5,2),
    "metrics_by_audit_type" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_idx" ON "auth_tokens"("user_id");

-- CreateIndex
CREATE INDEX "auth_tokens_type_idx" ON "auth_tokens"("type");

-- CreateIndex
CREATE INDEX "auth_tokens_expires_at_idx" ON "auth_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_snapshots_snapshot_date_key" ON "dashboard_snapshots"("snapshot_date");

-- CreateIndex
CREATE INDEX "dashboard_snapshots_snapshot_date_idx" ON "dashboard_snapshots"("snapshot_date");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
