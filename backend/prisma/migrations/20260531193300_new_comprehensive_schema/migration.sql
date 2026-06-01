/*
  Warnings:

  - You are about to drop the column `audit_type` on the `audit_runs` table. All the data in the column will be lost.
  - You are about to drop the column `file_size_bytes` on the `uploaded_files` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `dashboard_metrics` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rule_book` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `validation_issues` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `audit_type_id` to the `audit_runs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `audit_runs` table without a default value. This is not possible if the table is not empty.
  - Made the column `uploaded_by` on table `audit_runs` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `file_size` to the `uploaded_files` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uploaded_by` to the `uploaded_files` table without a default value. This is not possible if the table is not empty.
  - Made the column `file_hash` on table `uploaded_files` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `role_id` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "Severity" ADD VALUE 'INFO';

-- DropForeignKey
ALTER TABLE "audit_runs" DROP CONSTRAINT "audit_runs_uploaded_by_fkey";

-- DropForeignKey
ALTER TABLE "rule_book" DROP CONSTRAINT "rule_book_updated_by_fkey";

-- DropForeignKey
ALTER TABLE "validation_issues" DROP CONSTRAINT "validation_issues_audit_run_id_fkey";

-- DropIndex
DROP INDEX "audit_runs_audit_type_created_at_idx";

-- DropIndex
DROP INDEX "users_role_idx";

-- AlterTable
ALTER TABLE "audit_runs" DROP COLUMN "audit_type",
ADD COLUMN     "audit_type_id" INTEGER NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "uploaded_by" SET NOT NULL;

-- AlterTable
ALTER TABLE "uploaded_files" DROP COLUMN "file_size_bytes",
ADD COLUMN     "file_size" BIGINT NOT NULL,
ADD COLUMN     "mime_type" VARCHAR(100),
ADD COLUMN     "uploaded_by" INTEGER NOT NULL,
ALTER COLUMN "storage_path" DROP NOT NULL,
ALTER COLUMN "file_hash" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "role_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "dashboard_metrics";

-- DropTable
DROP TABLE "rule_book";

-- DropTable
DROP TABLE "validation_issues";

-- DropEnum
DROP TYPE "AuditType";

-- DropEnum
DROP TYPE "IssueType";

-- DropEnum
DROP TYPE "RuleType";

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "role_name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_types" (
    "id" SERIAL NOT NULL,
    "audit_code" VARCHAR(50) NOT NULL,
    "audit_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_rules" (
    "id" SERIAL NOT NULL,
    "audit_type_id" INTEGER NOT NULL,
    "rule_name" VARCHAR(100) NOT NULL,
    "product_norm" VARCHAR(100),
    "min_value" DECIMAL(15,4),
    "max_value" DECIMAL(15,4),
    "variation_percent" DECIMAL(5,2),
    "rule_config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_issue_counts" (
    "id" SERIAL NOT NULL,
    "audit_run_id" INTEGER NOT NULL,
    "issue_code" VARCHAR(50) NOT NULL,
    "issue_name" VARCHAR(100) NOT NULL,
    "issue_count" INTEGER NOT NULL DEFAULT 0,
    "severity" "Severity" NOT NULL DEFAULT 'ERROR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_issue_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gross_audit_summary" (
    "id" SERIAL NOT NULL,
    "audit_run_id" INTEGER NOT NULL,
    "gross_mismatch_count" INTEGER NOT NULL DEFAULT 0,
    "net_mismatch_count" INTEGER NOT NULL DEFAULT 0,
    "stone_mismatch_count" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gross_audit_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_audit_summary" (
    "id" SERIAL NOT NULL,
    "audit_run_id" INTEGER NOT NULL,
    "gold_deviation_count" INTEGER NOT NULL DEFAULT 0,
    "silver_deviation_count" INTEGER NOT NULL DEFAULT 0,
    "diamond_deviation_count" INTEGER NOT NULL DEFAULT 0,
    "missing_rule_count" INTEGER NOT NULL DEFAULT 0,
    "rate_out_of_range_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_audit_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "id_proof_audit_summary" (
    "id" SERIAL NOT NULL,
    "audit_run_id" INTEGER NOT NULL,
    "invalid_pan_count" INTEGER NOT NULL DEFAULT 0,
    "invalid_aadhar_count" INTEGER NOT NULL DEFAULT 0,
    "invalid_gst_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_pan_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_aadhar_count" INTEGER NOT NULL DEFAULT 0,
    "missing_id_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "id_proof_audit_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_performance" (
    "id" SERIAL NOT NULL,
    "audit_run_id" INTEGER NOT NULL,
    "processing_time_ms" INTEGER NOT NULL,
    "memory_usage_mb" DECIMAL(10,2),
    "rows_processed" INTEGER NOT NULL,
    "rows_per_second" DECIMAL(10,2),
    "cpu_usage_percent" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_summary" (
    "id" SERIAL NOT NULL,
    "summary_date" DATE NOT NULL,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_audit_metrics" (
    "id" SERIAL NOT NULL,
    "dashboard_summary_id" INTEGER NOT NULL,
    "audit_type_id" INTEGER NOT NULL,
    "total_audits" INTEGER NOT NULL DEFAULT 0,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "total_invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "avg_processing_time" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_audit_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_role_name_key" ON "roles"("role_name");

-- CreateIndex
CREATE INDEX "roles_role_name_idx" ON "roles"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "audit_types_audit_code_key" ON "audit_types"("audit_code");

-- CreateIndex
CREATE INDEX "audit_types_audit_code_idx" ON "audit_types"("audit_code");

-- CreateIndex
CREATE INDEX "audit_types_is_active_idx" ON "audit_types"("is_active");

-- CreateIndex
CREATE INDEX "master_rules_audit_type_id_is_active_idx" ON "master_rules"("audit_type_id", "is_active");

-- CreateIndex
CREATE INDEX "master_rules_rule_name_idx" ON "master_rules"("rule_name");

-- CreateIndex
CREATE INDEX "master_rules_product_norm_idx" ON "master_rules"("product_norm");

-- CreateIndex
CREATE INDEX "audit_issue_counts_audit_run_id_idx" ON "audit_issue_counts"("audit_run_id");

-- CreateIndex
CREATE INDEX "audit_issue_counts_issue_code_idx" ON "audit_issue_counts"("issue_code");

-- CreateIndex
CREATE UNIQUE INDEX "audit_issue_counts_audit_run_id_issue_code_key" ON "audit_issue_counts"("audit_run_id", "issue_code");

-- CreateIndex
CREATE UNIQUE INDEX "gross_audit_summary_audit_run_id_key" ON "gross_audit_summary"("audit_run_id");

-- CreateIndex
CREATE INDEX "gross_audit_summary_audit_run_id_idx" ON "gross_audit_summary"("audit_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_audit_summary_audit_run_id_key" ON "rate_audit_summary"("audit_run_id");

-- CreateIndex
CREATE INDEX "rate_audit_summary_audit_run_id_idx" ON "rate_audit_summary"("audit_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "id_proof_audit_summary_audit_run_id_key" ON "id_proof_audit_summary"("audit_run_id");

-- CreateIndex
CREATE INDEX "id_proof_audit_summary_audit_run_id_idx" ON "id_proof_audit_summary"("audit_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_performance_audit_run_id_key" ON "audit_performance"("audit_run_id");

-- CreateIndex
CREATE INDEX "audit_performance_audit_run_id_idx" ON "audit_performance"("audit_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_summary_summary_date_key" ON "dashboard_summary"("summary_date");

-- CreateIndex
CREATE INDEX "dashboard_summary_summary_date_idx" ON "dashboard_summary"("summary_date");

-- CreateIndex
CREATE INDEX "dashboard_audit_metrics_dashboard_summary_id_idx" ON "dashboard_audit_metrics"("dashboard_summary_id");

-- CreateIndex
CREATE INDEX "dashboard_audit_metrics_audit_type_id_idx" ON "dashboard_audit_metrics"("audit_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_audit_metrics_dashboard_summary_id_audit_type_id_key" ON "dashboard_audit_metrics"("dashboard_summary_id", "audit_type_id");

-- CreateIndex
CREATE INDEX "audit_runs_audit_type_id_created_at_idx" ON "audit_runs"("audit_type_id", "created_at");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_rules" ADD CONSTRAINT "master_rules_audit_type_id_fkey" FOREIGN KEY ("audit_type_id") REFERENCES "audit_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_rules" ADD CONSTRAINT "master_rules_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_audit_type_id_fkey" FOREIGN KEY ("audit_type_id") REFERENCES "audit_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_issue_counts" ADD CONSTRAINT "audit_issue_counts_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gross_audit_summary" ADD CONSTRAINT "gross_audit_summary_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_audit_summary" ADD CONSTRAINT "rate_audit_summary_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "id_proof_audit_summary" ADD CONSTRAINT "id_proof_audit_summary_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_performance" ADD CONSTRAINT "audit_performance_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_audit_metrics" ADD CONSTRAINT "dashboard_audit_metrics_dashboard_summary_id_fkey" FOREIGN KEY ("dashboard_summary_id") REFERENCES "dashboard_summary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_audit_metrics" ADD CONSTRAINT "dashboard_audit_metrics_audit_type_id_fkey" FOREIGN KEY ("audit_type_id") REFERENCES "audit_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
