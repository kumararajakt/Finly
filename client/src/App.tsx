import { useCallback, useState } from "react";
import AppSidebar from "./Sidebar";
import TopBar from "./components/TopBar";
import MobileBottomNav from "./components/MobileBottomNav";
import { SettingsProvider } from "./contexts/SettingsContext";
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

function App() {
  const [selectedMenu, setSelectedMenu] = useState("dashboard");
  const [addEntrySignal, setAddEntrySignal] = useState(0);

  const handleSelectMenu = useCallback((value: string) => {
    setSelectedMenu(value);
  }, []);

  const handleImport = useCallback(() => {
    setSelectedMenu("documents");
  }, []);

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
          <Page addEntrySignal={addEntrySignal} />
        </div>
      </AppSidebar>
      <MobileBottomNav
        selectedMenu={selectedMenu}
        onSelectMenu={handleSelectMenu}
      />
    </SettingsProvider>
  );
}

export default App;
