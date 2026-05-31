import "@radix-ui/themes/styles.css";
import "../global.css";
import { Flex, Theme } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { EventLog } from "./components/EventLog";
import { ActionsSection } from "./components/ActionsSection";
import { Debug } from "./components/debug";
import { initShop } from "./stores/shopStore";
import { initFish } from "./stores/fishStore";
import { pushEvent } from "./stores/eventLogStore";
import { EventMsg } from "./util/eventMessages";
import { InventoryView } from "./components/InventoryView.tsx";

function App() {
  const [showDebug, setShowDebug] = useState(
    () => localStorage.getItem("debug_panel_open") === "true",
  );

  useEffect(() => {
    initShop();
    initFish();
    pushEvent(EventMsg.WELCOME);
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "`")
        setShowDebug((prev) => {
          const next = !prev;
          localStorage.setItem("debug_panel_open", next);
          return next;
        });
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <Theme appearance={"dark"} accentColor={"gray"} grayColor={"mauve"}>
      <Flex
        direction="row"
        minHeight="100vh"
        px="5"
        py="5"
        gap="5"
        style={{ justifyContent: "center" }}
      >
        <EventLog />
        <ActionsSection />
        <InventoryView />
      </Flex>
      {showDebug && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: "40vh",
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
