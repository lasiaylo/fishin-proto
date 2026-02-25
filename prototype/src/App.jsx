// import './App.css'
import "../global.css";
import { Button, Container, Flex, Section, Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import { useEffect, useState } from "react";
import { LOOP } from "./GameLoop";
import { addVectorAmount, initVectors, VectorT } from "./stores/vectorStore.ts";
import { ResourceView } from "./components/ResourceView";
import { Debug } from "./components/debug";
import {
  addCapacity,
  addResourceAmount,
  addToBaseCapacity,
  RT,
  setResourceCapacity,
} from "./stores/resourceStore.ts";
import { PACK, pullColor, UpgradeButton } from "./upgradeButton.tsx";
import { addSpeed } from "./stores/delivererStore.ts";

const GROWTH = 1.15;
const BUY_COST = 40;
const REROLL_COST = BUY_COST / 2;
const BUILDING_COST = 100;
const ROAD_COST = 100;
const EXPAND_COST = 100;
const SPACE_COST = { initCosts: [1], growthRate: 1 };

const CARD_DISPLAY = {
  Grass: "🌾",
  Apple: "🍊",
  Forest: "🌳",
  Mountain: "🗻",
  River: "🌊",
};
const rerollCost = {
  [RT.Money]: { initCosts: [REROLL_COST], growthRate: 1 },
};

const tileCost = {
  [RT.Money]: { initCosts: [BUY_COST], growthRate: 1 },
  [RT.Space]: SPACE_COST,
};

const expandCost = {
  [RT.Money]: { initCosts: [EXPAND_COST], growthRate: 1.4 },
};

const buildingCost = {
  [RT.Production]: { initCosts: [BUILDING_COST], growthRate: 1 },
  [RT.CitySpace]: { initCosts: [1], growthRate: 1 },
};

const roadCost = {
  [RT.Production]: { initCosts: [ROAD_COST], growthRate: 1.25 },
};

function initShop(pack) {
  const shop = {};
  Object.keys(pack).forEach((key) => {
    shop[key] = 0;
  });
  return shop;
}

function App() {
  const [shop, setShop] = useState(initShop(PACK));

  function pull() {
    const newShop = initShop(PACK);
    Array(3)
      .fill(null)
      .forEach(() => {
        newShop[pullColor(PACK)] += 1;
      });
    setShop(newShop);

    console.log();
  }

  useEffect(() => {
    pull();
    LOOP.run();
    const vectorCleanup = initVectors();

    const showDebug = (e) => {
      switch (e.key) {
        case "`":
          pull();
      }
    };
    window.addEventListener("keyup", showDebug);

    return () => {
      vectorCleanup();
      window.removeEventListener("keyup", showDebug);
    };
  }, []);

  const [expandAmount, setExpandAmount] = useState(0);
  const [roadAmount, setRoadAmount] = useState(0);

  const incr = (amt) => amt + 1;

  const getButtons = (data) => {
    return (
      <Flex direction="column" maxWidth="200px" gap={"4"}>
        {data.map(({ label, amount, cost, onClick, disabled }) => (
          <UpgradeButton
            key={label}
            disabled={disabled}
            label={label}
            cost={cost}
            amount={amount ?? 1}
            onClick={onClick}
          />
        ))}
      </Flex>
    );
  };

  const buyTile = (tile) => {
    const newShop = { ...shop };
    newShop[tile] -= 1;
    if (Object.values(newShop).every((val) => val === 0)) {
      pull();
      return;
    }

    setShop(newShop);
  };

  const getTileData = () => {
    const types = Object.keys(PACK);
    return types.map((type) => ({
      label: `Buy ${CARD_DISPLAY[type]}`,
      cost: tileCost,
      disabled: shop[type] === 0,
      onClick: () => {
        buyTile(type);
        switch (type) {
          case "Apple":
          case "Grass":
            addResourceAmount(RT.Food, 1.5);
            break;
          case "Mountain":
            addVectorAmount(VectorT.Production, 2);
            break;
          case "Forest":
            addVectorAmount(VectorT.Production, 1);
            break;
          case "River":
            addVectorAmount(VectorT.Production, 1);
            addResourceAmount(RT.Food, 1);
            break;
        }
      },
    }));
  };

  let s = Object.entries(shop)
    // eslint-disable-next-line no-unused-vars
    .filter(([_key, val]) => val !== 0)
    .map(([key, val]) =>
      Array(val)
        .fill(key)
        .map((key) => CARD_DISPLAY[key])
        .join(" "),
    )
    .join(" ");
  console.log(s);

  return (
    <Theme accentColor={"gray"} grayColor={"mauve"}>
      <Container size="3" minHeight="100%" px="5">
        <Flex direction="column" flexGrow="1" mt={"9"} gapY={"5"}>
          <Flex direction="row">
            <Flex direction="column">
              <ResourceView rt={Object.values(RT)} />
            </Flex>
          </Flex>
          <Flex>{s}</Flex>
          {/*<Canvas />*/}
          <Flex direction="column" maxWidth="400px" gap={"4"}>
            <Button
              onClick={() => {
                addResourceAmount(RT.Money, 1);
              }}
            >
              Choo Choo
            </Button>
            <Flex gap={"4"}>
              {getButtons([
                {
                  label: "Reroll",
                  cost: rerollCost,
                  onClick: pull,
                },
                ...getTileData(),
                {
                  label: "Expand",
                  amount: expandAmount,
                  cost: expandCost,
                  onClick: () => {
                    setExpandAmount(incr);
                  },
                },
              ])}
              {getButtons([
                {
                  label: "Buy House",
                  amount: 1,
                  cost: buildingCost,
                  onClick: () => {
                    addCapacity(RT.Jimby, 2);
                  },
                },
                {
                  label: "Buy Road",
                  amount: roadAmount,
                  cost: roadCost,
                  onClick: () => {
                    setRoadAmount(incr);
                  },
                },
              ])}
            </Flex>
          </Flex>
          <Section>
            <Debug />
          </Section>
        </Flex>
      </Container>
    </Theme>
  );
}

export default App;
