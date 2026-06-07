import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { SessionBootstrap } from '../components/auth/SessionBootstrap';
import { LoginSkeleton } from '../components/layout/LoginSkeleton';

const Login = lazy(() => import('../pages/Login'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const ScrutinyHub = lazy(() => import('../pages/ScrutinyHub'));
const VouchingHub = lazy(() => import('../pages/VouchingHub'));
const PanVerification = lazy(() => import('../pages/PanVerification'));
const GrossWeight = lazy(() => import('../pages/GrossWeight'));
const SalesLedger = lazy(() => import('../pages/SalesLedger'));
const RateRuleBook = lazy(() => import('../pages/RateRuleBook'));
const DiamondGemRateBook = lazy(() => import('../pages/DiamondGemRateBook'));
const Reports = lazy(() => import('../pages/Reports'));
const Settings = lazy(() => import('../pages/Settings'));
const SalesReturnRateAudit = lazy(() => import('../pages/SalesReturnRateAudit'));
const ProductAverageRates = lazy(() => import('../pages/ProductAverageRates'));
const ModuleSoon = lazy(() => import('../pages/ModuleSoon'));
const VouchingHold = lazy(() => import('../pages/VouchingHold'));
const Users = lazy(() => import('../pages/Users'));
const Profile = lazy(() => import('../pages/Profile'));

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Suspense fallback={<LoginSkeleton />}>
            <Login />
          </Suspense>
        }
      />

      <Route element={<SessionBootstrap />}>
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
          <Route path="/sales-audit/product-average-rates" element={<ProductAverageRates />} />
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
      </Route>
    </Routes>
  );
}
