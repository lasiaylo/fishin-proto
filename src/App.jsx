import "@radix-ui/themes/styles.css";
import "../global.css";
import { Flex, Theme } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { EventView } from "./components/EventView.tsx";
import { ChatroomView } from "./components/ChatroomView.tsx";
import { ActionsSection } from "./components/ActionsSection";
import { Debug } from "./components/debug";
import { initShop, initShopFromRows } from "./stores/shopStore";
import { initDreamShop } from "./stores/dreamShopStore";
import { initFish, initFishFromData } from "./stores/fishStore";
import { initLocations } from "./stores/locationStore";
import { initBaitData } from "./stores/baitStore";
import { initRodData } from "./stores/rodStore";
import { initTipData } from "./stores/tipStore";
import { npcLogin, openGiftRequest } from "./stores/friendStore";
import { FRIEND_NPC_NAME } from "./util/constants";
import { clearEvents, pushEvent } from "./stores/eventLogStore";
import { EventMsg } from "./util/eventMessages";
import "./game/StoryTriggerListener";
import { useCsvConfig } from "./stores/csvConfigStore";
import {
  GENERATED_FISH_CSV,
  GENERATED_SHOP_CSV,
  getGeneratedFishRows,
  getGeneratedShopRows,
} from "./components/model/CsvGenerator";
import { loadFishDisplayMap, parseFishGameplayRows } from "./util/csvLoader";
import { InventoryView } from "./components/InventoryView.tsx";

function App() {
  const [showDebug, setShowDebug] = useState(
    () => localStorage.getItem("debug_panel_open") === "true",
  );

  useEffect(() => {
    clearEvents();
    const { fishCSV, shopCSV } = useCsvConfig.getState();
    if (fishCSV === GENERATED_FISH_CSV) {
      loadFishDisplayMap().then((displayMap) =>
        initFishFromData(
          parseFishGameplayRows(getGeneratedFishRows(), displayMap),
        ),
      );
    } else {
      initFish(fishCSV);
    }
    if (shopCSV === GENERATED_SHOP_CSV) {
      initShopFromRows(getGeneratedShopRows());
    } else {
      initShop(shopCSV);
    }
    initDreamShop();
    initLocations();
    initBaitData();
    initRodData();
    initTipData();
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
      if (e.key === "n") npcLogin(FRIEND_NPC_NAME);
      if (e.key === "m") openGiftRequest();
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
        <Flex direction="column" gap="4">
          <EventView />
          <ChatroomView />
        </Flex>
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
