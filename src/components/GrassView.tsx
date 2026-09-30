import React, { CSSProperties } from "react";
import {
  collectParticle,
  depositParticle,
  useFields,
} from "../stores/fieldsStore";
import { Collectables } from "./CollectableLayer";
import {
  FIELDS_PARTICLE_FADE_MS,
  FIELDS_PARTICLE_LIFETIME_MS,
} from "../util/constants";

export function GrassView() {
  return (
    <img
      src="/grass.png"
      alt=""
      width={147}
      style={{ display: "block", height: "auto" }}
    />
  );
}

// Wind particles drifting off the grass. Rendered in the CollectableLayer at
// the grass image's position; particle coordinates are relative to it.
export function GrassParticles({ left, top }: { left: number; top: number }) {
  const particles = useFields((s) => s.particles);
  return (
    <Collectables
      left={left}
      top={top}
      items={particles}
      getId={(p) => p.id}
      itemClassName="grass-particle"
      itemStyle={(p) =>
        ({
          "--ox": `${p.originX}px`,
          "--oy": `${p.originY}px`,
          "--x": `${p.x}px`,
          "--y": `${p.y}px`,
          "--fade-ms": `${FIELDS_PARTICLE_FADE_MS}ms`,
          "--fade-delay": `${FIELDS_PARTICLE_LIFETIME_MS - FIELDS_PARTICLE_FADE_MS}ms`,
        }) as CSSProperties
      }
      renderItem={() => <div className="grass-particle-dot" />}
      collect={collectParticle}
      deposit={depositParticle}
    />
  );
}
