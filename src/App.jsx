import "@radix-ui/themes/styles.css";
import "../global.css";
import { Box, Flex, Theme } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { EventView } from "./components/EventView.tsx";
import { ChatroomView } from "./components/ChatroomView.tsx";
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
import { TackleBoxView } from "./components/TackleBoxView.tsx";
import { PondFishView } from "./components/PondFishView.tsx";
import { CurrencyView } from "./components/CurrencyView.tsx";
import { GrassParticles, GrassView } from "./components/GrassView.tsx";
import { CollectableLayer } from "./components/CollectableLayer.tsx";

// Shared by each image and its collectables in the CollectableLayer, which
// float above the rest of the layout.
const GRASS_POS = { left: 237, top: 45 };
const POND_POS = { left: 422, top: 167 };

function App() {
  const [showDebug, setShowDebug] = useState(
    () => localStorage.getItem("debug_panel_open") === "true",
  );
  const shopUnlocked = useShopUnlocked();

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
    initTipData();
    pushEvent(EventMsg.WELCOME);
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.repeat) return;
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
        height="700px"
        px="5"
        py="5"
        justify="between"
        position="relative"
      >
        <Flex direction="column" gap="4">
          <EventView />
          <ChatroomView />
        </Flex>
        <Flex direction="row" gap="4" align="start">
          {shopUnlocked && (
            <Flex className={"fade-in"}>
              <ShopView />
            </Flex>
          )}
          <TackleBoxView />
        </Flex>
        <Box
          position="absolute"
          top={`${GRASS_POS.top}px`}
          left={`${GRASS_POS.left}px`}
        >
          <GrassView />
        </Box>
        <Box
          position="absolute"
          top={`${POND_POS.top}px`}
          left={`${POND_POS.left}px`}
        >
          <img
            src="/pond.jpg"
            alt=""
            width={332}
            height={332}
            style={{ display: "block", objectFit: "cover" }}
          />
        </Box>
        <Box
          position="absolute"
          top="5"
          left="50%"
          style={{ transform: "translateX(-50%)" }}
        >
          <CurrencyView />
        </Box>
        <Box position="absolute" bottom="5" left="5">
          <ActionsSection />
        </Box>
        <CollectableLayer>
          <GrassParticles {...GRASS_POS} />
          <PondFishView {...POND_POS} />
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
