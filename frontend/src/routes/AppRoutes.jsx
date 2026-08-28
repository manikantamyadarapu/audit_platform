import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { RequireAuth } from '../components/auth/RequireAuth';
import { GuestRoute } from '../components/auth/GuestRoute';
import { LoginSkeleton } from '../components/layout/LoginSkeleton';

const Login = lazy(() => import('../pages/Login'));
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/ResetPassword'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const ScrutinyHub = lazy(() => import('../pages/ScrutinyHub'));
const VouchingHub = lazy(() => import('../pages/VouchingHub'));
const FinancialsHub = lazy(() => import('../pages/FinancialsHub'));
const FinancialsPivotPage = lazy(() => import('../pages/FinancialsPivotPage'));
const PanVerification = lazy(() => import('../pages/PanVerification'));
const GrossWeight = lazy(() => import('../pages/GrossWeight'));
const PurchaseGrossWeight = lazy(() => import('../pages/PurchaseGrossWeight'));
const SalesPage = lazy(() => import('../pages/SalesPage'));
const PurchasePage = lazy(() => import('../pages/PurchasePage'));
const PurchaseReturnPage = lazy(() => import('../pages/PurchaseReturnPage'));
const CashLedgerPage = lazy(() => import('../pages/CashLedgerPage'));
const NegativeBankPage = lazy(() => import('../pages/NegativeBankPage'));
const RateRuleBook = lazy(() => import('../pages/RateRuleBook'));
const DiamondGemRateBook = lazy(() => import('../pages/DiamondGemRateBook'));
const TdsPage = lazy(() => import('../pages/TdsPage'));
const PartyWiseTdsSummaryPage = lazy(() => import('../pages/PartyWiseTdsSummaryPage'));
const TdsRate01Page = lazy(() => import('../pages/TdsRate01Page'));
const Reports = lazy(() => import('../pages/Reports'));
const Settings = lazy(() => import('../pages/Settings'));
const SalesReturnPage = lazy(() => import('../pages/SalesReturnPage'));
const ProductAverageRates = lazy(() => import('../pages/ProductAverageRates'));
const ModuleSoon = lazy(() => import('../pages/ModuleSoon'));
const VouchingHold = lazy(() => import('../pages/VouchingHold'));
const Users = lazy(() => import('../pages/Users'));
const Profile = lazy(() => import('../pages/Profile'));
const Section44ABPage = lazy(() => import('../pages/Section44ABPage'));
const DemoVideosPage = lazy(() => import('../pages/DemoVideosPage'));

function lazyPage(Component) {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <Component />
    </Suspense>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={lazyPage(Login)} />
        <Route path="/forgot-password" element={lazyPage(ForgotPassword)} />
      </Route>

      <Route path="/reset-password" element={lazyPage(ResetPassword)} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={lazyPage(Dashboard)} />
          <Route path="/scrutiny" element={lazyPage(ScrutinyHub)} />
          <Route path="/financials" element={lazyPage(FinancialsHub)} />
          <Route path="/vouching" element={lazyPage(VouchingHub)} />
          <Route path="/reports" element={lazyPage(Reports)} />
          <Route path="/settings" element={lazyPage(Settings)} />
          <Route path="/profile" element={lazyPage(Profile)} />
          <Route path="/users" element={lazyPage(Users)} />
          <Route path="/demo-videos" element={lazyPage(DemoVideosPage)} />

          <Route path="/scrutiny/pan" element={lazyPage(PanVerification)} />
          <Route path="/scrutiny/gross-weight" element={lazyPage(GrossWeight)} />
          <Route path="/scrutiny/purchase/gross-weight" element={lazyPage(PurchaseGrossWeight)} />
          <Route path="/scrutiny/sales-ledger" element={lazyPage(SalesPage)} />
          <Route path="/scrutiny/purchase/rate-ledger" element={lazyPage(PurchasePage)} />
          <Route path="/scrutiny/purchase/return-rate" element={lazyPage(PurchaseReturnPage)} />
          <Route path="/scrutiny/cash-ledger" element={lazyPage(CashLedgerPage)} />
          <Route path="/scrutiny/negative-bank" element={lazyPage(NegativeBankPage)} />
          <Route path="/sales-audit/product-average-rates" element={lazyPage(ProductAverageRates)} />
          <Route path="/scrutiny/making-charges" element={lazyPage(ModuleSoon)} />
          <Route path="/scrutiny/sales-return-rate" element={lazyPage(SalesReturnPage)} />
          <Route path="/scrutiny/rate-rule-book" element={lazyPage(RateRuleBook)} />
          <Route path="/scrutiny/diamond-gem-rates" element={lazyPage(DiamondGemRateBook)} />
          <Route path="/scrutiny/tds/rule-book" element={lazyPage(TdsPage)} />
          <Route
            path="/scrutiny/tds/party-wise-summary"
            element={lazyPage(PartyWiseTdsSummaryPage)}
          />
          <Route path="/scrutiny/tds/rate-0.1" element={lazyPage(TdsRate01Page)} />
          <Route path="/scrutiny/rate-rules" element={lazyPage(RateRuleBook)} />
          <Route path="/scrutiny/rule-book" element={lazyPage(RateRuleBook)} />
          <Route path="/scrutiny/section44ab" element={lazyPage(Section44ABPage)} />
          <Route path="/scrutiny/duplicate-invoice" element={lazyPage(ModuleSoon)} />
          <Route path="/scrutiny/vendor-reconciliation" element={lazyPage(ModuleSoon)} />

          <Route path="/financials/closing-stock" element={lazyPage(FinancialsPivotPage)} />
          <Route path="/financials/first-audit" element={<Navigate to="/financials/closing-stock" replace />} />

          <Route path="/vouching/voucher-matching" element={lazyPage(VouchingHold)} />
          <Route path="/vouching/ledger-review" element={lazyPage(VouchingHold)} />
          <Route path="/vouching/entry-verification" element={lazyPage(VouchingHold)} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
