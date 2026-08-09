import { useCallback, useState } from "react";
import AppSidebar from "./Sidebar";
import TopBar from "./components/TopBar";
import MobileBottomNav from "./components/MobileBottomNav";
import LoadingState from "./components/ui/loading-state";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import TransactionPage from "./pages/TransactionPage";
import RecurringPage from "./pages/RecurringPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import BudgetsPage from "./pages/BudgetsPage";
import GoalsPage from "./pages/GoalsPage";
import RulesPage from "./pages/RulesPage";
import SettingsPage from "./pages/SettingsPage";
import DocumentsPage from "./pages/DocumentsPage";

interface PageProps {
  addEntrySignal?: number;
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

function FinlyApp() {
  const { status } = useAuth();
  const [selectedMenu, setSelectedMenu] = useState("dashboard");
  const [addEntrySignal, setAddEntrySignal] = useState(0);

  const handleSelectMenu = useCallback((value: string) => {
    setSelectedMenu(value);
  }, []);

  const handleImport = useCallback(() => {
    setSelectedMenu("documents");
  }, []);

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

  const Page = pages[selectedMenu] ?? DashboardPage;

  return (
    <SettingsProvider>
      <AppSidebar
        selectedMenu={selectedMenu}
        onSelectMenu={handleSelectMenu}
      >
        <TopBar
          selectedMenu={selectedMenu}
          onImport={handleImport}
          onAddEntry={() => setAddEntrySignal((signal) => signal + 1)}
        />
        <div className="p-4 pb-24 md:p-6 md:pb-6">
          <Page addEntrySignal={addEntrySignal} onNavigate={handleSelectMenu} />
        </div>
      </AppSidebar>
      <MobileBottomNav
        selectedMenu={selectedMenu}
        onSelectMenu={handleSelectMenu}
      />
    </SettingsProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <FinlyApp />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
