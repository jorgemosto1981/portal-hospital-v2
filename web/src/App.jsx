import { useState } from "react";
import MobileLayout from "./components/layout/MobileLayout.jsx";
import TabContentHost from "./features/shell/TabContentHost.jsx";

export default function App() {
  const [activeTab, setActiveTab] = useState("inicio");
  return (
    <MobileLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <TabContentHost activeTab={activeTab} />
    </MobileLayout>
  );
}
