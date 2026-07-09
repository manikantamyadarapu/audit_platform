import LedgerAuditPage from './LedgerAuditPage';
import { SALES_LEDGER_AUDIT_CONFIG } from '../config/ledgerAuditConfig';

export default function SalesLedger() {
  return <LedgerAuditPage config={SALES_LEDGER_AUDIT_CONFIG} />;
}
