import { loadSoundData, SoundRowData } from "../util/csvLoader";
import { useSoundSettings } from "../stores/soundSettingsStore";
import type { SoundEvent } from "./soundEvents";

// Folder under public/ that Sound.csv file names are relative to.
const SOUND_DIR = "walk sounds";

// Plays one-shot sounds mapped to game events in public/data/Sound.csv.
// Inert until enable() is called, so pages that reuse the game's stores
// without being the game (the /model view) stay silent.
class SoundEngine {
  private enabled = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rows = new Map<string, SoundRowData>();
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<void>>();
  private warned = new Set<string>();
  private initPromise: Promise<void> | null = null;

  // Starts loading sounds and arms the first-gesture unlock. Safe to call
  // twice (StrictMode); returns a cleanup that disarms the engine.
  enable(): () => void {
    this.enabled = true;
    void this.init();
    const unlock = () => this.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    const unsubscribe = useSoundSettings.subscribe(() => this.applyVolume());
    return () => {
      this.enabled = false;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      unsubscribe();
    };
  }

  play(event: SoundEvent) {
    const row = this.rows.get(event);
    if (!row) return;
    if (!this.enabled || !this.ctx || !this.master) return;
    if (row.files.length === 0) return;
    const file = row.files[Math.floor(Math.random() * row.files.length)];
    const buffer = this.buffers.get(file);
    if (!buffer) {
      void this.load(file);
      return;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = Math.max(0, row.volume);
    source.connect(gain).connect(this.master);
    source.start();
  }

  private init(): Promise<void> {
    this.initPromise ??= loadSoundData()
      .then((rows) => {
        for (const row of rows) this.rows.set(row.event, row);
        return Promise.all(
          rows.flatMap((r) => r.files).map((f) => this.load(f)),
        );
      })
      .then(() => {})
      .catch((e) => console.warn(`Sound.csv: ${(e as Error).message}`));
    return this.initPromise;
  }

  // The context is created on the first gesture, since browsers block audio
  // before one.
  private unlock() {
    if (!this.enabled) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private applyVolume() {
    if (!this.master) return;
    const { masterVolume, muted } = useSoundSettings.getState();
    this.master.gain.value = muted ? 0 : masterVolume;
  }

  // Decodes through an OfflineAudioContext, which needs no user gesture, so
  // sounds are ready by the time the first click arrives.
  private load(file: string): Promise<void> {
    if (this.buffers.has(file)) return Promise.resolve();
    let pending = this.loading.get(file);
    if (!pending) {
      pending = fetch(encodeURI(`/${SOUND_DIR}/${file}`))
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          // The dev server answers unknown paths with index.html and a 200.
          if (res.headers.get("content-type")?.includes("text/html")) {
            throw new Error("not found under public/ (check the path)");
          }
          return res.arrayBuffer();
        })
        .then((data) =>
          new OfflineAudioContext(1, 1, 44100).decodeAudioData(data),
        )
        .then((buffer) => {
          this.buffers.set(file, buffer);
        })
        .catch((e) => {
          if (!this.warned.has(file)) {
            this.warned.add(file);
            console.warn(
              `Sound "${file}" failed to load: ${(e as Error).message}`,
            );
          }
        });
      this.loading.set(file, pending);
    }
    return pending;
  }
}

export const soundEngine = new SoundEngine();

export function playSound(event: SoundEvent) {
  soundEngine.play(event);
}
