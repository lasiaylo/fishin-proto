import React, { CSSProperties } from "react";
import { Code } from "@radix-ui/themes";
import {
  collectPondFish,
  depositPondFish,
  PondFish,
  usePondFish,
} from "../stores/pondFishStore";
import { FISH_SPRITES, Rarity, RARITY_COLOR } from "../util/constants";
import { Collectables } from "./CollectableLayer";

// Caught fish blow out of the pond and float around its edge until hovered,
// then fly to the wallet and pay out on landing. Rendered in the
// CollectableLayer at the pond image's position; fish coordinates are
// relative to it.
export function PondFishView({ left, top }: { left: number; top: number }) {
  const fish = usePondFish((s) => s.fish);
  return (
    <Collectables
      left={left}
      top={top}
      items={fish}
      getId={(f) => f.id}
      itemClassName="pond-fish"
      itemStyle={(f) =>
        ({
          "--ox": `${f.originX}px`,
          "--oy": `${f.originY}px`,
          "--x": `${f.x}px`,
          "--y": `${f.y}px`,
        }) as CSSProperties
      }
      renderItem={(f) => (
        <div className="pond-fish-body">
          <FishLook item={f} />
        </div>
      )}
      collect={collectPondFish}
      deposit={depositPondFish}
    />
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
