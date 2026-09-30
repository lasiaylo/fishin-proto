import React, { CSSProperties, useState } from "react";
import { Box } from "@radix-ui/themes";
import {
  collectParticle,
  depositParticle,
  useFields,
} from "../stores/fieldsStore";
import { FlyToWallet, randomFlightArc } from "./FlyToWallet";
import {
  FIELDS_PARTICLE_FADE_MS,
  FIELDS_PARTICLE_LIFETIME_MS,
} from "../util/constants";

interface Flyer {
  id: number;
  startX: number;
  startY: number;
  arc: number;
  startOpacity: number;
}

export function GrassView() {
  const particles = useFields((s) => s.particles);
  const [flyers, setFlyers] = useState<Flyer[]>([]);

  function collect(id: number, e: React.MouseEvent<HTMLDivElement>) {
    // Start the flight where the dot is drawn right now (mid-bob/drift).
    const dot = e.currentTarget.firstElementChild ?? e.currentTarget;
    const rect = dot.getBoundingClientRect();
    // The hit area fades in while drifting and the dot fades out near the end
    // of its life, so the drawn opacity is the product of both.
    const startOpacity =
      Number(getComputedStyle(e.currentTarget).opacity) *
      Number(getComputedStyle(dot).opacity);
    if (!collectParticle(id)) return;
    setFlyers((f) => [
      ...f,
      {
        id,
        startX: rect.left + rect.width / 2,
        startY: rect.top + rect.height / 2,
        arc: randomFlightArc(),
        startOpacity,
      },
    ]);
  }

  return (
    <Box position="relative">
      <img
        src="/grass.png"
        alt=""
        width={147}
        style={{ display: "block", height: "auto" }}
      />
      {particles.map((p) => (
        <div
          key={p.id}
          className="grass-particle"
          onMouseEnter={(e) => collect(p.id, e)}
          style={
            {
              "--ox": `${p.originX}px`,
              "--oy": `${p.originY}px`,
              "--x": `${p.x}px`,
              "--y": `${p.y}px`,
              "--fade-ms": `${FIELDS_PARTICLE_FADE_MS}ms`,
              "--fade-delay": `${FIELDS_PARTICLE_LIFETIME_MS - FIELDS_PARTICLE_FADE_MS}ms`,
            } as CSSProperties
          }
        >
          <div className="grass-particle-dot" />
        </div>
      ))}
      {flyers.map((f) => (
        <FlyToWallet
          key={f.id}
          startX={f.startX}
          startY={f.startY}
          arc={f.arc}
          startOpacity={f.startOpacity}
          onLand={() => {
            depositParticle();
            setFlyers((all) => all.filter((other) => other.id !== f.id));
          }}
        >
          <div className="grass-particle-dot" />
        </FlyToWallet>
      ))}
    </Box>
  );
}
