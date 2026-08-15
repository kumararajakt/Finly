import { Suspense, lazy, useCallback } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router";
import AppSidebar from "./Sidebar";
import TopBar from "./components/TopBar";
import MobileBottomNav from "./components/MobileBottomNav";
import LoadingState from "./components/ui/loading-state";
import OnboardingDialog from "./components/OnboardingDialog";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import AuthPage from "./pages/AuthPage";
import { menuPath } from "./utils/menu";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TransactionPage = lazy(() => import("./pages/TransactionPage"));
const RecurringPage = lazy(() => import("./pages/RecurringPage"));
const SubscriptionsPage = lazy(() => import("./pages/SubscriptionsPage"));
const BudgetsPage = lazy(() => import("./pages/BudgetsPage"));
const GoalsPage = lazy(() => import("./pages/GoalsPage"));
const RulesPage = lazy(() => import("./pages/RulesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));

interface PageProps {
  onNavigate?: (value: string) => void;
}

const pages: Record<string, React.ComponentType<PageProps>> = {
  dashboard: DashboardPage,
  transactions: TransactionPage,
  recurring: RecurringPage,
  subscriptions: SubscriptionsPage,
  budgets: BudgetsPage,
  goals: GoalsPage,
  rules: RulesPage,
  settings: SettingsPage,
  documents: DocumentsPage,
};

function AppShell() {
  const navigate = useNavigate();
  const handleNavigate = useCallback(
    (value: string) => navigate(menuPath(value)),
    [navigate]
  );

  return (
    <>
      <AppSidebar>
        <TopBar />
        <div className="p-4 pb-24 md:p-6 md:pb-6">
          <Suspense fallback={<LoadingState label="Loading…" />}>
            <Routes>
              <Route index element={<Navigate to={menuPath("dashboard")} replace />} />
              {Object.entries(pages).map(([value, Component]) => (
                <Route
                  key={value}
                  path={menuPath(value)}
                  element={<Component onNavigate={handleNavigate} />}
                />
              ))}
              <Route path="*" element={<Navigate to={menuPath("dashboard")} replace />} />
            </Routes>
          </Suspense>
        </div>
      </AppSidebar>
      <MobileBottomNav />
    </>
  );
}

function FinlyApp() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <LoadingState className="w-full max-w-sm" label="Checking session…" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <AuthPage />;
  }

  return (
    <SettingsProvider>
      <AppShell />
      {user && !user.onboardingComplete ? <OnboardingDialog /> : null}
    </SettingsProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <FinlyApp />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
