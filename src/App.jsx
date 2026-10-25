import "@radix-ui/themes/styles.css";
import "../global.css";
import { Box, Flex, Theme } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { EventView } from "./components/EventView.tsx";
import { ActionsSection } from "./components/ActionsSection";
import { ShopView } from "./components/ShopView.tsx";
import { Debug } from "./components/debug";
import {
  initShop,
  initShopFromRows,
  useShopUnlocked,
} from "./stores/shopStore";
import { initFish, initFishFromData } from "./stores/fishStore";
import { restorePersistedRodSlots } from "./stores/playerStore";
import { initLocations } from "./stores/locationStore";
import { initBaitData } from "./stores/baitStore";
import { initRodData } from "./stores/rodStore";
import { initStoryData } from "./stores/storyStore";
import { clearEvents } from "./stores/eventLogStore";
import { tellStory } from "./game/StoryTriggerListener";
import { useCsvConfig } from "./stores/csvConfigStore";
import {
  GENERATED_FISH_CSV,
  GENERATED_SHOP_CSV,
  getGeneratedFishRows,
  getGeneratedShopRows,
} from "./components/model/CsvGenerator";
import { loadFishDisplayMap, parseFishGameplayRows } from "./util/csvLoader";
import { PondFishView } from "./components/PondFishView.tsx";
import { GrassView } from "./components/GrassView.tsx";
import { CollectableLayer } from "./components/CollectableLayer.tsx";
import { useUnlocks } from "./stores/unlockStore";
import { GridCellBox } from "./components/WorldGrid.tsx";
import { soundEngine } from "./audio/SoundEngine";
import { CELL_SIZE, cellPos, POND_CELL } from "./util/worldGrid";

function App() {
  const [showDebug, setShowDebug] = useState(
    () => localStorage.getItem("debug_panel_open") === "true",
  );
  const shopUnlocked = useShopUnlocked();
  const pondUnlocked = useUnlocks((s) => s.pond);

  useEffect(() => {
    clearEvents();
    // Must run before shop init below: it establishes rod slot
    // count via setRodSlotCount, which preserves whatever's already at each
    // index, so restoring first means the upgrade-driven resize keeps these
    // assignments instead of them being overwritten before restore runs.
    restorePersistedRodSlots();
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
    initLocations();
    initBaitData();
    initRodData();
    // Skip the welcome if StrictMode unmounted us before the CSV loaded.
    let cancelled = false;
    initStoryData().then(() => {
      if (!cancelled) tellStory("start");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => soundEngine.enable(), []);

  useEffect(() => {
    function handleKey(e) {
      if (e.repeat) return;
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
        height="500px"
        width="1250px"
        px="5"
        py="6"
        justify="between"
        position="relative"
      >
        <EventView />
        {shopUnlocked && (
          <Flex className={"fade-in"} align="start">
            <ShopView />
          </Flex>
        )}
        <GrassView />
        {pondUnlocked && (
          <GridCellBox cell={POND_CELL}>
            <img
              src="/pond.jpg"
              alt=""
              width={CELL_SIZE}
              height={CELL_SIZE}
              style={{ display: "block", objectFit: "cover" }}
            />
          </GridCellBox>
        )}
        <Box position="absolute" bottom="0" left="5">
          <ActionsSection />
        </Box>
        <CollectableLayer>
          <PondFishView {...cellPos(POND_CELL)} />
        </CollectableLayer>
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
