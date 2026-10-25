import React from "react";
import { Button, Flex, Slider } from "@radix-ui/themes";
import {
  setMasterVolume,
  setMuted,
  useSoundSettings,
} from "../stores/soundSettingsStore";

export function SoundControls() {
  const masterVolume = useSoundSettings((s) => s.masterVolume);
  const muted = useSoundSettings((s) => s.muted);

  return (
    <Flex
      align="center"
      gap="2"
      style={{ position: "fixed", top: 8, right: 8, width: 150, zIndex: 10 }}
    >
      <Button
        size="1"
        variant="outline"
        radius="none"
        onClick={() => setMuted(!muted)}
      >
        {muted ? "Unmute" : "Mute"}
      </Button>
      <Slider
        size="1"
        min={0}
        max={1}
        step={0.05}
        value={[masterVolume]}
        disabled={muted}
        onValueChange={([v]) => setMasterVolume(v)}
      />
    </Flex>
  );
}
