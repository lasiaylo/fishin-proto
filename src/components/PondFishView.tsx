import React, { CSSProperties, useState } from "react";
import { Code } from "@radix-ui/themes";
import {
  collectPondFish,
  depositPondFish,
  PondFish,
  usePondFish,
} from "../stores/pondFishStore";
import { FISH_SPRITES, Rarity, RARITY_COLOR } from "../util/constants";
import { FlyToWallet, randomFlightArc } from "./FlyToWallet";

interface Flyer {
  item: PondFish;
  startX: number;
  startY: number;
  arc: number;
  startOpacity: number;
}

// Overlays the pond image: caught fish blow out of the pond and float around
// its edge until hovered, then fly to the wallet and pay out on landing.
export function PondFishView() {
  const fish = usePondFish((s) => s.fish);
  const [flyers, setFlyers] = useState<Flyer[]>([]);

  function collect(id: number, e: React.MouseEvent<HTMLDivElement>) {
    // Start the flight where the fish is drawn right now (mid-drift/bob),
    // at the opacity it's drawn with if it's still fading in.
    const rect = (
      e.currentTarget.firstElementChild ?? e.currentTarget
    ).getBoundingClientRect();
    const startOpacity = Number(getComputedStyle(e.currentTarget).opacity);
    const item = collectPondFish(id);
    if (!item) return;
    setFlyers((f) => [
      ...f,
      {
        item,
        startX: rect.left + rect.width / 2,
        startY: rect.top + rect.height / 2,
        arc: randomFlightArc(),
        startOpacity,
      },
    ]);
  }

  return (
    <>
      {fish.map((f) => (
        <div
          key={f.id}
          className="pond-fish"
          onMouseEnter={(e) => collect(f.id, e)}
          style={
            {
              "--ox": `${f.originX}px`,
              "--oy": `${f.originY}px`,
              "--x": `${f.x}px`,
              "--y": `${f.y}px`,
            } as CSSProperties
          }
        >
          <div className="pond-fish-body">
            <FishLook item={f} />
          </div>
        </div>
      ))}
      {flyers.map((f) => (
        <FlyToWallet
          key={f.item.id}
          startX={f.startX}
          startY={f.startY}
          arc={f.arc}
          startOpacity={f.startOpacity}
          onLand={() => {
            depositPondFish(f.item);
            setFlyers((all) => all.filter((other) => other !== f));
          }}
        >
          <div>
            <FishLook item={f.item} />
          </div>
        </FlyToWallet>
      ))}
    </>
  );
}

function FishLook({ item }: { item: PondFish }) {
  const sprite = FISH_SPRITES[item.fish.id];
  if (sprite) {
    return (
      <img
        src={sprite}
        alt={item.fish.name}
        className={
          item.rarity === Rarity.LEGENDARY
            ? "pond-fish-sprite pond-fish-legendary"
            : "pond-fish-sprite"
        }
        // Common fish get no outline; --outline falls back to transparent.
        style={
          item.rarity === Rarity.COMMON
            ? undefined
            : ({
                "--outline": `var(--${RARITY_COLOR[item.rarity]}-9)`,
              } as CSSProperties)
        }
        draggable={false}
      />
    );
  }
  return (
    <Code
      size="1"
      color={RARITY_COLOR[item.rarity]}
      className={
        item.rarity === Rarity.LEGENDARY ? "rarity-legendary" : undefined
      }
      style={{ whiteSpace: "nowrap" }}
    >
      {item.fish.name}
    </Code>
  );
}
