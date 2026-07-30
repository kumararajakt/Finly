import { useState } from "react";
import AppSidebar from "./Sidebar";
import TransactionPage from "./pages/TransactionPage";

function App() {
  const [selectedMenu, setSelectedMenu] = useState("dashboard");

  return (
    <>
      <AppSidebar selectedMenu={selectedMenu} setSelectedMenu={setSelectedMenu}>
        {selectedMenu === "transaction" && <TransactionPage />}
      </AppSidebar>
    </>
  );
}

export default App;
