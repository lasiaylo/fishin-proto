import "../global.css";
import { Flex, Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import { useEffect } from "react";
import { EventLog } from "./components/EventLog";
import { InventoryPanel } from "./components/InventoryPanel";
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

        {/* Actions Section — placeholder for Phase 4 */}
        <Flex flexGrow="1" direction="column">
          Actions
        </Flex>

        {/* Inventory */}
        <InventoryPanel />
      </Flex>
    </Theme>
  );
}

export default App;
