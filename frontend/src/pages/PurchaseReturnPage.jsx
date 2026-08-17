import SalesReturnPage from './SalesReturnPage';
import { PURCHASE_RETURN_AUDIT_CONFIG } from '../config/salesReturnAuditConfig';

/**
 * Purchase Return Audit — dedicated purchase-return APIs and purchase baseline.
 * UI matches Sales Return / Purchase Rate & Ledger patterns via shared page + config.
 */
export default function PurchaseReturnPage() {
  return <SalesReturnPage config={PURCHASE_RETURN_AUDIT_CONFIG} />;
}
