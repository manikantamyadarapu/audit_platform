import GrossWeightAuditPage from './GrossWeightAuditPage';
import { SALES_GROSS_WEIGHT_AUDIT_CONFIG } from '../config/grossWeightAuditConfig';

export default function GrossWeight() {
  return <GrossWeightAuditPage config={SALES_GROSS_WEIGHT_AUDIT_CONFIG} />;
}
