-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- Seed / upsert live audit type catalog used by tryPersistAuditRun
INSERT INTO "audit_types" ("audit_code", "audit_name", "description", "is_active", "created_at", "updated_at")
VALUES
  ('SALES', 'Rate & Ledger Audit', 'Sales rate and ledger validation', true, NOW(), NOW()),
  ('PURCHASE', 'Purchase Rate & Ledger Audit', 'Purchase rate and ledger validation', true, NOW(), NOW()),
  ('SALES_RETURN', 'Sales Return Audit', 'Sales return validation and rate comparison', true, NOW(), NOW()),
  ('PURCHASE_RETURN', 'Purchase Return Audit', 'Purchase return validation and rate comparison', true, NOW(), NOW()),
  ('PAN', 'ID Proof Audit', 'PAN and address proof validation', true, NOW(), NOW()),
  ('GROSS', 'Gross Weight Audit', 'Gross weight mismatch validation', true, NOW(), NOW()),
  ('FINANCIALS_PIVOT', 'Closing Stock Audit', 'Financials closing stock pivot and opening stock validation', true, NOW(), NOW()),
  ('CASH_LEDGER', 'Cash Ledger Audit', 'Cash ledger scrutiny validation', true, NOW(), NOW()),
  ('NEGATIVE_BANK', 'Negative Bank Audit', 'Negative bank balance scrutiny validation', true, NOW(), NOW()),
  ('PARTY_WISE_TDS', 'Party Wise TDS Summary', 'Party-wise TDS purchase and payable summary', true, NOW(), NOW()),
  ('TDS_01', 'TDS @ 0.1%', 'TDS at 0.1 percent rate audit', true, NOW(), NOW()),
  ('SECTION44AB', 'Section 44AB', 'Section 44AB cash and bank audit', true, NOW(), NOW())
ON CONFLICT ("audit_code") DO UPDATE SET
  "audit_name" = EXCLUDED."audit_name",
  "description" = EXCLUDED."description",
  "is_active" = true,
  "updated_at" = NOW();
