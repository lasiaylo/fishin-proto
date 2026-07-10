import "@radix-ui/themes/styles.css";
import "../global.css";
import { Flex, Theme } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { EventView } from "./components/EventView.tsx";
import { ActionsSection } from "./components/ActionsSection";
import { Debug } from "./components/debug";
import { initShop, initShopFromRows } from "./stores/shopStore";
import { initDreamShop } from "./stores/dreamShopStore";
import { forceEndDay, useDayStore } from "./stores/dayStore";
import { EndOfDayPopup } from "./components/EndOfDayPopup";
import { initFish, initFishFromData } from "./stores/fishStore";
import { initLocations } from "./stores/locationStore";
import { initBaitData } from "./stores/baitStore";
import { initRodData } from "./stores/rodStore";
import { pushEvent } from "./stores/eventLogStore";
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
  const isEndOfDay = useDayStore((s) => s.isEndOfDay);

  useEffect(() => {
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
      if (e.key === "Escape") forceEndDay();
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
        <EventView />
        <ActionsSection />
        <InventoryView />
      </Flex>
      {isEndOfDay && <EndOfDayPopup />}
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
