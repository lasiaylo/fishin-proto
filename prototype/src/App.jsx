import "../global.css";
import { Flex, Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import { useEffect } from "react";
import { EventLog } from "./components/EventLog";
import { InventoryPanel } from "./components/InventoryPanel";
import { ActionsSection } from "./components/ActionsSection";
import { initShop } from "./stores/shopStore";
import { initFish } from "./stores/fishStore";
import { pushEvent } from "./stores/eventLogStore";

function App() {
  useEffect(() => {
    initShop();
    initFish();
    pushEvent("Welcome to the fishing game!");
  }, []);

  return (
    <Theme accentColor={"gray"} grayColor={"mauve"}>
      <Flex
        direction="row"
        minHeight="100vh"
        px="5"
        py="5"
        gap="5"
      >
        {/* Event Log */}
        <EventLog />

        {/* Actions Section */}
        <ActionsSection />

        {/* Inventory */}
        <InventoryPanel />
      </Flex>
    </Theme>
  );
}

export default App;
