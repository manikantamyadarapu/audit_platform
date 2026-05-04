import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import Dashboard from '../pages/Dashboard';
import ScrutinyHub from '../pages/ScrutinyHub';
import VouchingHub from '../pages/VouchingHub';
import PanVerification from '../pages/PanVerification';
import GrossWeight from '../pages/GrossWeight';
import SalesLedger from '../pages/SalesLedger';
import Reports from '../pages/Reports';
import Settings from '../pages/Settings';
import ModuleSoon from '../pages/ModuleSoon';
import VouchingHold from '../pages/VouchingHold';
import PlatformPlaceholder from '../pages/PlatformPlaceholder';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/scrutiny" element={<ScrutinyHub />} />
        <Route path="/vouching" element={<VouchingHub />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/audit-runs" element={<PlatformPlaceholder />} />
        <Route path="/exceptions" element={<PlatformPlaceholder />} />
        <Route path="/clients" element={<PlatformPlaceholder />} />
        <Route path="/team-activity" element={<PlatformPlaceholder />} />

        <Route path="/scrutiny/pan" element={<PanVerification />} />
        <Route path="/scrutiny/gross-weight" element={<GrossWeight />} />
        <Route path="/scrutiny/sales-ledger" element={<SalesLedger />} />
        <Route path="/scrutiny/gst" element={<ModuleSoon />} />
        <Route path="/scrutiny/duplicate-invoice" element={<ModuleSoon />} />
        <Route path="/scrutiny/vendor-reconciliation" element={<ModuleSoon />} />

        <Route path="/vouching/voucher-matching" element={<VouchingHold />} />
        <Route path="/vouching/ledger-review" element={<VouchingHold />} />
        <Route path="/vouching/entry-verification" element={<VouchingHold />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
