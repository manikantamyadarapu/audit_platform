import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import Dashboard from '../pages/Dashboard';
import ScrutinyHub from '../pages/ScrutinyHub';
import VouchingHub from '../pages/VouchingHub';
import PanVerification from '../pages/PanVerification';
import GrossWeight from '../pages/GrossWeight';
import SalesLedger from '../pages/SalesLedger';
import RateRuleBook from '../pages/RateRuleBook';
import DiamondGemRateBook from '../pages/DiamondGemRateBook';
import Reports from '../pages/Reports';
import Settings from '../pages/Settings';
import SalesReturnRateAudit from '../pages/SalesReturnRateAudit';
import ModuleSoon from '../pages/ModuleSoon';
import VouchingHold from '../pages/VouchingHold';
import Login from '../pages/Login';
import Users from '../pages/Users';
import Profile from '../pages/Profile';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes - no layout */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes with AppLayout */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/scrutiny" element={<ScrutinyHub />} />
        <Route path="/vouching" element={<VouchingHub />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/users" element={<Users />} />

        <Route path="/scrutiny/pan" element={<PanVerification />} />
        <Route path="/scrutiny/gross-weight" element={<GrossWeight />} />
        <Route path="/scrutiny/sales-ledger" element={<SalesLedger />} />
        <Route path="/scrutiny/making-charges" element={<ModuleSoon />} />
        <Route path="/scrutiny/sales-return-rate" element={<SalesReturnRateAudit />} />
        <Route path="/scrutiny/rate-rule-book" element={<RateRuleBook />} />
        <Route path="/scrutiny/diamond-gem-rates" element={<DiamondGemRateBook />} />
        <Route path="/scrutiny/rate-rules" element={<RateRuleBook />} />
        <Route path="/scrutiny/rule-book" element={<RateRuleBook />} />
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
