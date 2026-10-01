import React, { useEffect, useRef, useState } from "react";
import { Box, Flex } from "@radix-ui/themes";
import { CooldownButton } from "./CooldownButton";
import { birdsLandedAt, observe, useBirds } from "../stores/birdStore";
import { OBSERVE_COOLDOWN_MS } from "../util/constants";
import { pushEvent } from "../stores/eventLogStore";
import { EventMsg } from "../util/eventMessages";

function Bird({ landed }: { landed: boolean }) {
  return (
    <Box
      width="16px"
      height="16px"
      style={{
        backgroundColor: landed ? "#e8d44d" : "transparent",
        border: "1px solid var(--gray-a6)",
        transition: "background-color 0.3s",
      }}
    />
  );
}

export function SkyView() {
  const observeReadyAt = useBirds((s) => s.observeReadyAt);
  const [landed, setLanded] = useState(() => birdsLandedAt(Date.now()));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    function tick() {
      setLanded(birdsLandedAt(Date.now()));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // cycles never change after init; anchors are read fresh via birdsLandedAt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleObserve() {
    const { birdCount, payout } = observe();
    if (birdCount > 0) {
      const msg = EventMsg.OBSERVED_BIRDS(birdCount, payout);
      pushEvent(msg[0], msg[1]);
    } else {
      pushEvent(EventMsg.OBSERVED_NOTHING);
    }
  }

  return (
    <Flex direction="column" justify="end" gap="4" py="3" minHeight={"150px"}>
      <Flex gap="1" wrap="wrap" maxWidth="200px">
        {landed.map((isLanded, i) => (
          <Bird key={i} landed={isLanded} />
        ))}
      </Flex>
      <CooldownButton
        readyAt={observeReadyAt}
        cooldownMs={OBSERVE_COOLDOWN_MS}
        onFire={handleObserve}
        width={100}
      >
        observe
      </CooldownButton>
    </Flex>
  );
}
