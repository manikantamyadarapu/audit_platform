import GrossWeightAuditPage from './GrossWeightAuditPage';
import { PURCHASE_GROSS_WEIGHT_AUDIT_CONFIG } from '../config/grossWeightAuditConfig';

export default function PurchaseGrossWeight() {
  return <GrossWeightAuditPage config={PURCHASE_GROSS_WEIGHT_AUDIT_CONFIG} />;
}
