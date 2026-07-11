import LedgerAuditPage from './LedgerAuditPage';
import { PURCHASE_LEDGER_AUDIT_CONFIG } from '../config/ledgerAuditConfig';

export default function PurchaseLedger() {
  return <LedgerAuditPage config={PURCHASE_LEDGER_AUDIT_CONFIG} />;
}
