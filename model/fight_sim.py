import random
import statistics
from dataclasses import dataclass

import matplotlib.cm as cm
import matplotlib.colors as mcolors
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt

@dataclass
class FrameRecord:
    time: float
    line_distance: float
    line_tension: float
    phase: str          # "STRUGGLE" or "REST"
    super_attack: bool

REEL_STR_RANGE = range(1, 2)
NUM_TRIALS = 100
MAX_DISTANCE = 100
MAX_SIM_TIME = 60

REST_TIME = (1, 6)
FIGHT_TIME = (1, 6)
BASE_SPEED = 10
MAX_SPEED = 20
BASE_REEL = 20
DELTA_GROWTH = 1.25
REEL_GROWTH = 1.25
ATTACK_CHANCE = 0.0

FISH_SPEED = 10
FISH_STRENGTH = 10
REEL_STR = 10
DRAG = 10
LINE_HP = 0

class Fight:
    def __init__(self, fish_speed: float, fish_strength: float,
                 reel_str: float, drag: float, line_hp: float):
        self.fish_speed = fish_speed
        self.fish_strength = fish_strength
        self.reel_str = reel_str
        self.drag = drag
        self.line_hp = line_hp

        self.distance: float = MAX_DISTANCE / 2
        self.tension: float = 0.0
        self.time: float = 0.0
        self.history: list[FrameRecord] = []

        self.phase: str = "STRUGGLE"
        self.phase_time: float = 0.0
        self.phase_duration: float = 0.0
        self.setPhase("STRUGGLE")
        self.super_attack = False
        
    def reset(self):
        self.distance = MAX_DISTANCE / 2
        self.tension = 0.0
        self.time = 0.0
        self.history = []
        self.phase = "STRUGGLE"
        self.phase_time = 0.0
        self.phase_duration = 0.0
        self.setPhase("STRUGGLE")
        self.super_attack = False

    def setPhase(self, phase):
        self.phase_time = 0
        self.phase = phase
        if self.phase == "STRUGGLE" and random.random() <= ATTACK_CHANCE:
            self.super_attack = True
        else:
            self.super_attack = False
        next_time = FIGHT_TIME if self.phase == "STRUGGLE" else REST_TIME
        self.phase_duration = random.uniform(next_time[0], next_time[1])
        self.phase_duration = 6 if self.super_attack else self.phase_duration
        
    def tryPhaseSwitch(self, dt):
        self.phase_time += dt
        if self.phase_time >= self.phase_duration:
            phase = "REST" if self.phase == "STRUGGLE" else "STRUGGLE"
            self.setPhase(phase)


    def getDelta(self, bonus = 0):
        speed_delta = (self.fish_speed + bonus) - self.drag
        speed = BASE_SPEED * pow(DELTA_GROWTH, speed_delta)
        speed = min(MAX_SPEED, max(BASE_SPEED, speed))

        reel_delta = self.reel_str - (self.fish_strength + bonus)
        reel = BASE_REEL * pow(REEL_GROWTH, reel_delta)
        return speed, reel
    
    
    def getStruggle(self, dt) -> float:
        bonus = 100 if self.super_attack else 0
        (speed, reel) = self.getDelta(bonus)
        if self.tension < self.line_hp:
        # if False:
            distance= speed - reel
            self.tension += (self.fish_strength + bonus) * dt
        else:
            distance = speed
        return distance * dt

    def getRest(self, dt) -> float:
        (speed, reel) = self.getDelta()
        return (speed - reel) * dt

    def run(self):
        dt = 0.5
        self.history.append(FrameRecord(
            time=self.time,
            line_distance=self.distance,
            line_tension=self.tension,
            phase=self.phase,
            super_attack=self.super_attack,
        ))
        while self.time < MAX_SIM_TIME:
            self.tryPhaseSwitch(dt)
            distance = self.getStruggle(dt) if self.phase == "STRUGGLE" else self.getRest(dt)
            distance = max(-15.0, min(15.0, distance))
            self.distance += distance * dt
            
            self.time += dt
            self.history.append(FrameRecord(
                time=self.time,
                line_distance=self.distance,
                line_tension=self.tension,
                phase=self.phase,
                super_attack=self.super_attack,
            ))
            if self.distance <= 0:
                return ("WIN", self.time)
            if self.distance >= MAX_DISTANCE:
                return ("LOSE", self.time)
        return ("TIMEOUT", self.time)

def plot(histories: list[list[FrameRecord]], results: list[tuple]):
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
        prev = history[0]
        for curr in history:
            if curr.phase != prev.phase or curr is history[-1]:
                if prev.phase == "STRUGGLE":
                    color = "#ff000050" if prev.super_attack else "#ff000018"
                else:
                    color = "#00ff0018"
                for ax in (ax_dist, ax_tens):
                    ax.axvspan(phase_start, curr.time - 0.5, color=color)
                phase_start = max(0.0, curr.time - 0.5)
                prev = curr

    # ── distance subplot ──
    for history in histories:
        times = [r.time for r in history]
        distances = [r.line_distance for r in history]
        ax_dist.plot(times, distances, color="dodgerblue", linewidth=1.2,
                     alpha=1.0 if single else 0.5)

    ax_dist.axhline(0, linestyle="--", color="green", alpha=0.5, linewidth=0.8)
    ax_dist.axhline(MAX_DISTANCE, linestyle="--", color="red", alpha=0.5, linewidth=0.8)
    ax_dist.set_ylabel("Line Distance")
    ax_dist.set_ylim(0, MAX_DISTANCE + 0.1)

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

    ax_tens.axhline(LINE_HP, linestyle="--", color="red", alpha=0.5, linewidth=0.8)
    ax_tens.set_ylabel("Line Tension")
    ax_tens.set_xlabel("Time (s)")

    plt.tight_layout()
    plt.show()


def plot_sweep(sweep_data: dict[int, list[list[FrameRecord]]]):
    fig, ax = plt.subplots(figsize=(14, 7))

    reel_values = sorted(sweep_data.keys())
    norm = mcolors.Normalize(vmin=min(reel_values), vmax=max(reel_values))
    cmap = cm.viridis

    for reel_str in reel_values:
        color = cmap(norm(reel_str))
        for i, history in enumerate(sweep_data[reel_str]):
            times = [r.time for r in history]
            distances = [r.line_distance for r in history]
            ax.plot(times, distances, color=color, linewidth=0.8, alpha=0.35,
                    label=f"reel={reel_str}" if i == 0 else None)

    ax.axhline(0, linestyle="--", color="green", alpha=0.5, linewidth=0.8)
    ax.axhline(MAX_DISTANCE, linestyle="--", color="red", alpha=0.5, linewidth=0.8)
    ax.set_ylabel("Line Distance")
    ax.set_xlabel("Time (s)")
    ax.set_ylim(0, MAX_DISTANCE + 0.1)
    ax.set_title(
        f"Line Distance by Reel Str [{min(reel_values)}..{max(reel_values)}]  "
        f"(fish_spd={FISH_SPEED}, fish_str={FISH_STRENGTH}, {NUM_TRIALS} trials each)",
        fontsize=13,
    )

    sm = cm.ScalarMappable(cmap=cmap, norm=norm)
    sm.set_array([])
    fig.colorbar(sm, ax=ax, label="Reel Strength")

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    sweep_data: dict[int, list[list[FrameRecord]]] = {}
    sweep_results: dict[int, list[tuple]] = {}

    for reel_str in REEL_STR_RANGE:
        sim = Fight(fish_speed=FISH_SPEED, fish_strength=FISH_STRENGTH,
                    reel_str=reel_str, drag=DRAG, line_hp=LINE_HP)
        histories = []
        results = []
        for _ in range(NUM_TRIALS):
            result = sim.run()
            histories.append(list(sim.history))
            results.append(result)
            sim.reset()
        sweep_data[reel_str] = histories
        sweep_results[reel_str] = results

    if len(REEL_STR_RANGE) == 1:
        reel_str = list(REEL_STR_RANGE)[0]
        histories = sweep_data[reel_str]
        results = sweep_results[reel_str]

        # ── summary table ──
        times = sorted(t for _, t in results)
        wins = sum(1 for r, _ in results if r == "WIN")
        n = len(results)
        print(f"\n{'Metric':<15} {'Value':>10}")
        print(f"{'-'*15} {'-'*10}")
        print(f"{'Win %':<15} {wins * 100 / n:>9.1f}%")
        print(f"{'Avg Time':<15} {statistics.mean(times):>9.2f}s")
        print(f"{'P1 Time':<15} {statistics.quantiles(times, n=100)[0]:>9.2f}s")
        print(f"{'Median Time':<15} {statistics.median(times):>9.2f}s")
        print(f"{'P99 Time':<15} {statistics.quantiles(times, n=100)[98]:>9.2f}s")

        plot(histories, results)
    else:
        # ── summary table ──
        print(f"\n{'Reel Str':<10} {'Win %':>8} {'Avg Time':>10}")
        print(f"{'-'*10} {'-'*8} {'-'*10}")
        for reel_str in sorted(sweep_results):
            rs = sweep_results[reel_str]
            wins = sum(1 for r, _ in rs if r == "WIN")
            avg_t = statistics.mean(t for _, t in rs)
            print(f"{reel_str:<10} {wins * 100 / len(rs):>7.0f}% {avg_t:>9.1f}s")

        plot_sweep(sweep_data)
