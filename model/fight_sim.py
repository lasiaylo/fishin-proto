import random
import statistics
from dataclasses import dataclass

import matplotlib.patches as mpatches
import matplotlib.pyplot as plt


@dataclass
class FrameRecord:
    time: float
    line_distance: float
    line_tension: float
    phase: str          # "STRUGGLE" or "REST"

MAX_SIM_TIME = 60
REST_TIME = (3.5, 6.5)
FIGHT_TIME = (2, 4)
NUM_TRIALS = 30
class Fight:
    def __init__(self, fish_speed: float, fish_strength: float,
                 reel_str: float, drag: float, line_hp: float):
        self.fish_speed = fish_speed
        self.fish_strength = fish_strength
        self.reel_str = reel_str
        self.drag = drag
        self.line_hp = line_hp

        self.distance: float = 50
        self.tension: float = 0.0
        self.time: float = 0.0
        self.history: list[FrameRecord] = []

        self.phase: str = "STRUGGLE"
        self.phase_time: float = 0.0
        self.phase_duration: float = 0.0
        self.setPhase("STRUGGLE")
        
    def reset(self):
        self.distance = 50
        self.tension = 0.0
        self.time = 0.0
        self.history = []
        self.phase = "STRUGGLE"
        self.phase_time = 0.0
        self.phase_duration = 0.0
        self.setPhase("STRUGGLE")

    def setPhase(self, phase):
        self.phase_time = 0
        self.phase = phase
        next_time = FIGHT_TIME if self.phase == "STRUGGLE" else REST_TIME
        self.phase_duration = random.uniform(next_time[0], next_time[1])
        
    def tryPhaseSwitch(self, dt):
        self.phase_time += dt
        if self.phase_time >= self.phase_duration:
            phase = "REST" if self.phase == "STRUGGLE" else "STRUGGLE"
            self.setPhase(phase)

    def getStruggle(self, dt) -> float:
        if self.tension < self.line_hp:
            distance = (self.fish_speed - (max(0.0, self.reel_str - self.fish_strength) + self.drag))
            self.tension += self.fish_strength * dt
        else:
            distance = max(0.0, self.fish_speed - self.drag)
        return distance

    def getRest(self) -> float:
        return self.fish_speed / 4 - self.reel_str

    def run(self):
        dt = 0.5
        while self.time < MAX_SIM_TIME:
            self.tryPhaseSwitch(dt)
            distance = self.getStruggle(dt) if self.phase == "STRUGGLE" else self.getRest()
            distance = max(-15.0, min(15.0, distance))
            self.distance += distance * dt

            self.history.append(FrameRecord(
                time=self.time,
                line_distance=self.distance,
                line_tension=self.tension,
                phase=self.phase,
            ))

            if self.distance <= 0:
                return ("WIN", self.time)
            if self.distance >= 100:
                return ("LOSE", self.time)
            self.time += dt
        return ("TIMEOUT", self.time)

def plot(histories: list[list[FrameRecord]], results: list[tuple], line_hp: float):
    fig, (ax_dist, ax_tens) = plt.subplots(
        2, 1, sharex=True, figsize=(12, 7),
        gridspec_kw={"height_ratios": [3, 1]},
    )
    fig.subplots_adjust(hspace=0.08)

    single = len(histories) == 1

    # ── phase shading (single trial only) ──
    if single:
        history = histories[0]
        phase_start = 0.0
        prev_phase = history[0].phase
        for r in history:
            if r.phase != prev_phase or r is history[-1]:
                color = "#ff000018" if prev_phase == "STRUGGLE" else "#00ff0018"
                for ax in (ax_dist, ax_tens):
                    ax.axvspan(phase_start, r.time - 0.5, color=color)
                phase_start = max(0, r.time - 0.5)
                prev_phase = r.phase

    # ── distance subplot ──
    for history in histories:
        times = [r.time for r in history]
        distances = [r.line_distance for r in history]
        ax_dist.plot(times, distances, color="dodgerblue", linewidth=1.2,
                     alpha=1.0 if single else 0.5)

    ax_dist.axhline(0, linestyle="--", color="green", alpha=0.5, linewidth=0.8)
    ax_dist.axhline(100, linestyle="--", color="red", alpha=0.5, linewidth=0.8)
    ax_dist.set_ylabel("Line Distance")
    ax_dist.set_ylim(-5, 105)

    # ── title ──
    if single:
        result, t = results[0]
        title = f"{result} at {t:.1f}s"
    else:
        wins = sum(1 for r, _ in results if r == "WIN")
        avg_time = sum(t for _, t in results) / len(results)
        title = f"Win: {wins * 100 // len(results)}% | Avg Time: {avg_time:.1f}s"
    ax_dist.set_title(title, fontsize=14)

    # ── legend (single trial only) ──
    if single:
        struggle_patch = mpatches.Patch(color="#ff000030", label="Struggle")
        rest_patch = mpatches.Patch(color="#00ff0030", label="Rest")
        ax_dist.legend(handles=[struggle_patch, rest_patch], loc="upper right")

    # ── tension subplot ──
    for history in histories:
        times = [r.time for r in history]
        tensions = [r.line_tension for r in history]
        ax_tens.plot(times, tensions, color="orangered", linewidth=1.2,
                     alpha=1.0 if single else 0.5)

    ax_tens.axhline(line_hp, linestyle="--", color="red", alpha=0.5, linewidth=0.8)
    ax_tens.set_ylabel("Line Tension")
    ax_tens.set_xlabel("Time (s)")

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    line_hp = 10
    sim = Fight(fish_speed=10, fish_strength=1, reel_str=10, drag=1, line_hp=line_hp)

    histories = []
    results = []
    for i in range(NUM_TRIALS):
        result = sim.run()
        if NUM_TRIALS == 1:
            print(f"Trial {i+1}: {result[0]} at {result[1]:.2f}s  "
              f"(tension {sim.tension:.2f}/{sim.line_hp})")
        histories.append(list(sim.history))
        results.append(result)
        sim.reset()

    # ── summary table ──
    times = sorted(t for _, t in results)
    wins = sum(1 for r, _ in results if r == "WIN")
    n = len(results)
    print(f"\n{'Metric':<15} {'Value':>10}")
    print(f"{'-'*15} {'-'*10}")
    print(f"{'Win %':<15} {wins * 100 / n:>9.1f}%")
    print(f"{'Avg Time':<15} {statistics.mean(times):>9.2f}s")
    print(f"{'P1 Time':<15} {statistics.quantiles(times, n=100)[0]:>9.2f}s")
    print(f"{'P50 Time':<15} {statistics.median(times):>9.2f}s")
    print(f"{'P99 Time':<15} {statistics.quantiles(times, n=100)[98]:>9.2f}s")

    plot(histories, results, line_hp)
