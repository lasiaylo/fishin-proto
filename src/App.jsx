import "../global.css";
import { Flex, Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import { useEffect, useState } from "react";
import { EventLog } from "./components/EventLog";
import { InventoryPanel } from "./components/InventoryPanel";
import { ActionsSection } from "./components/ActionsSection";
import { Debug } from "./components/debug";
import { initShop } from "./stores/shopStore";
import { initFish } from "./stores/fishStore";
import { pushEvent } from "./stores/eventLogStore";

function App() {
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    initShop();
    initFish();
    pushEvent("Welcome to the fishing game!");
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "`") setShowDebug((prev) => !prev);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <Theme accentColor={"gray"} grayColor={"mauve"}>
      <Flex direction="row" minHeight="100vh" px="5" py="5" gap="5">
        {/* Event Log */}
        <EventLog />

        {/* Actions Section */}
        <ActionsSection />

        {/* Inventory */}
        <InventoryPanel />
      </Flex>
      {showDebug && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: "80vh",
            overflowY: "auto",
            background: "var(--color-background)",
            borderTop: "1px solid var(--gray-6)",
            zIndex: 999,
          }}
        >
          <Debug />
        </div>
      )}
    </Theme>
  );
}

export default App;
