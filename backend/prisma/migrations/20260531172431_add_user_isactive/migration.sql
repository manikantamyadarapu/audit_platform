-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AUDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "AuditType" AS ENUM ('SALES', 'GROSS_WEIGHT', 'PAN_AUDIT', 'DIAMOND_RATE');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('GOLD', 'SILVER', 'DIAMOND', 'GEMSTONE', 'UOM');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('INVALID_PRODUCT_MAPPING', 'INVALID_UOM', 'INVALID_RATE_DEVIATION', 'INVALID_UNIT_RATE_RANGE', 'MISSING_RATE_RULE', 'MISSING_UNIT_RATE');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('ERROR', 'WARNING');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'AUDITOR',
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_runs" (
    "id" SERIAL NOT NULL,
    "audit_type" "AuditType" NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "uploaded_by" INTEGER,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "status" "AuditStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_book" (
    "id" SERIAL NOT NULL,
    "rule_type" "RuleType" NOT NULL,
    "product_name" VARCHAR(100) NOT NULL,
    "product_norm" VARCHAR(100) NOT NULL,
    "min_rate" DECIMAL(12,2),
    "max_rate" DECIMAL(12,2),
    "variation_pct" DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    "updated_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rule_book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" SERIAL NOT NULL,
    "audit_run_id" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "file_size_bytes" BIGINT,
    "file_hash" VARCHAR(64),
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_metrics" (
    "id" SERIAL NOT NULL,
    "audit_date" DATE NOT NULL,
    "total_files" INTEGER NOT NULL DEFAULT 0,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "sales_audits" INTEGER NOT NULL DEFAULT 0,
    "gw_audits" INTEGER NOT NULL DEFAULT 0,
    "pan_audits" INTEGER NOT NULL DEFAULT 0,
    "avg_processing_sec" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_issues" (
    "id" SERIAL NOT NULL,
    "audit_run_id" INTEGER NOT NULL,
    "row_number" INTEGER NOT NULL,
    "issue_type" "IssueType" NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'ERROR',
    "message" TEXT,
    "field_name" VARCHAR(50),
    "expected_value" TEXT,
    "actual_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "audit_runs_audit_type_created_at_idx" ON "audit_runs"("audit_type", "created_at");

-- CreateIndex
CREATE INDEX "audit_runs_status_idx" ON "audit_runs"("status");

-- CreateIndex
CREATE INDEX "audit_runs_uploaded_by_idx" ON "audit_runs"("uploaded_by");

-- CreateIndex
CREATE INDEX "audit_runs_created_at_idx" ON "audit_runs"("created_at");

-- CreateIndex
CREATE INDEX "rule_book_rule_type_is_active_idx" ON "rule_book"("rule_type", "is_active");

-- CreateIndex
CREATE INDEX "rule_book_product_norm_idx" ON "rule_book"("product_norm");

-- CreateIndex
CREATE UNIQUE INDEX "rule_book_product_norm_rule_type_key" ON "rule_book"("product_norm", "rule_type");

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_files_audit_run_id_key" ON "uploaded_files"("audit_run_id");

-- CreateIndex
CREATE INDEX "uploaded_files_audit_run_id_idx" ON "uploaded_files"("audit_run_id");

-- CreateIndex
CREATE INDEX "uploaded_files_file_hash_idx" ON "uploaded_files"("file_hash");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_metrics_audit_date_key" ON "dashboard_metrics"("audit_date");

-- CreateIndex
CREATE INDEX "dashboard_metrics_audit_date_idx" ON "dashboard_metrics"("audit_date");

-- CreateIndex
CREATE INDEX "validation_issues_audit_run_id_idx" ON "validation_issues"("audit_run_id");

-- CreateIndex
CREATE INDEX "validation_issues_issue_type_idx" ON "validation_issues"("issue_type");

-- CreateIndex
CREATE INDEX "validation_issues_audit_run_id_row_number_idx" ON "validation_issues"("audit_run_id", "row_number");

-- AddForeignKey
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_book" ADD CONSTRAINT "rule_book_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
