import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SoundSettingsState {
  masterVolume: number;
  muted: boolean;
}

export const useSoundSettings = create<SoundSettingsState>()(
  persist<SoundSettingsState>(() => ({ masterVolume: 0.7, muted: false }), {
    name: "sound-settings",
  }),
);

export function setMasterVolume(volume: number) {
  useSoundSettings.setState({ masterVolume: Math.min(1, Math.max(0, volume)) });
}

export function setMuted(muted: boolean) {
  useSoundSettings.setState({ muted });
}
