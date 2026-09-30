import React, { CSSProperties, useState } from "react";
import { FlyToWallet, randomFlightArc } from "./FlyToWallet";

// Full-size overlay rendered above the rest of the layout, so collectables
// spawned by any view (grass, pond, …) can float over other UI and stay
// hoverable. Only the collectables themselves take pointer events.
export function CollectableLayer({ children }: { children: React.ReactNode }) {
  return <div className="collectable-layer">{children}</div>;
}

interface Flyer<T> {
  item: T;
  startX: number;
  startY: number;
  arc: number;
  startOpacity: number;
}

// A set of collectables anchored at (left, top) within the CollectableLayer;
// item coordinates are relative to that anchor. Hovering an item collects it
// and flies it to the wallet, depositing it on landing.
export function Collectables<T>({
  left,
  top,
  items,
  getId,
  itemClassName,
  itemStyle,
  renderItem,
  collect,
  deposit,
}: {
  left: number;
  top: number;
  items: T[];
  getId: (item: T) => number;
  itemClassName: string;
  itemStyle: (item: T) => CSSProperties;
  // The drawn element; reused as the flyer's content. Keep per-state
  // animations scoped to `.itemClassName > …` so they don't carry into flight.
  renderItem: (item: T) => React.ReactElement;
  // Removes the item; returns it, or undefined if it was already collected.
  collect: (id: number) => T | undefined;
  deposit: (item: T) => void;
}) {
  const [flyers, setFlyers] = useState<Flyer<T>[]>([]);

  function onHover(id: number, e: React.MouseEvent<HTMLDivElement>) {
    // Start the flight where the item is drawn right now (mid-drift/bob).
    const drawn = e.currentTarget.firstElementChild ?? e.currentTarget;
    const rect = drawn.getBoundingClientRect();
    // The hit area fades in while drifting and the drawn element may fade
    // out near the end of its life, so the drawn opacity is the product.
    const startOpacity =
      Number(getComputedStyle(e.currentTarget).opacity) *
      Number(getComputedStyle(drawn).opacity);
    const item = collect(id);
    if (item === undefined) return;
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
    <div className="collectable-group" style={{ left, top }}>
      {items.map((item) => {
        const id = getId(item);
        return (
          <div
            key={id}
            className={`collectable ${itemClassName}`}
            onMouseEnter={(e) => onHover(id, e)}
            style={itemStyle(item)}
          >
            {renderItem(item)}
          </div>
        );
      })}
      {flyers.map((f) => (
        <FlyToWallet
          key={getId(f.item)}
          startX={f.startX}
          startY={f.startY}
          arc={f.arc}
          startOpacity={f.startOpacity}
          onLand={() => {
            deposit(f.item);
            setFlyers((all) => all.filter((other) => other !== f));
          }}
        >
          {renderItem(f.item)}
        </FlyToWallet>
      ))}
    </div>
  );
}
