import { useState } from "react";
import AppSidebar from "./Sidebar";

function App() {
  const [selectedMenu, setSelectedMenu] = useState("home");

  return (
    <>
      <AppSidebar selectedMenu={selectedMenu} setSelectedMenu={setSelectedMenu}>
        <></>
      </AppSidebar>
    </>
  );
}

export default App;
