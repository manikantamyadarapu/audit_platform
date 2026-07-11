import SalesReturnRateAudit from './SalesReturnRateAudit';
import { PURCHASE_RETURN_AUDIT_CONFIG } from '../config/salesReturnAuditConfig';

/**
 * Purchase Return Audit — reuses the Sales Return Rate & Ledger page and API.
 * Excel format (with/without Purchase Voucher No) is auto-detected in Python.
 */
export default function PurchaseReturnRateAudit() {
  return <SalesReturnRateAudit config={PURCHASE_RETURN_AUDIT_CONFIG} />;
}
