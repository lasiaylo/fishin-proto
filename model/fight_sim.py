import random
import statistics
from dataclasses import dataclass

import numpy as np
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

SWEEP_PARAM = "both"  # "reel_str", "drag", "both", or "none"
SWEEP_RANGE = range(1, 20)
REEL_STR = 10
DRAG = 10

NUM_TRIALS = 500
MAX_DISTANCE = 100
MAX_SIM_TIME = 120

REST_TIME = [2, 6]
FIGHT_TIME = [1.0, 6.0]
BASE_SPEED = 10
MIN_SPEED = -40
BASE_REEL = 25
MAX_REEL = 25
SPEED_GROWTH = 1.1
REEL_GROWTH = 1.1
OUT_LEVELED_THRESHOLD = 4
OUT_LEVELED = 1.5
ATTACK_CHANCE = 0.1
LINE_HP = 100

FISH_SPEED = 10
FISH_STRENGTH = 10
FISH_STAMINA = 30
FISH_TIMEOUT = 20

class Fight:
    def __init__(self, fish_speed: float, fish_strength: float,
                 reel_str: float, drag: float, line_hp: float):
        self.fish_speed = fish_speed
        self.fish_str = fish_strength
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
        self.super_attack = False
        self.setPhase("STRUGGLE")
        
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
    
    def isOutLeveled(self):
        speed_delta = self.fish_speed - self.drag
        str_delta = self.fish_str - self.reel_str
        return speed_delta > OUT_LEVELED_THRESHOLD or str_delta > OUT_LEVELED_THRESHOLD

    def setPhase(self, phase):
        self.phase_time = 0
        self.phase = phase
        self.super_attack = False
        if self.phase == "STRUGGLE":
            next_time = list(FIGHT_TIME)
            if self.time >= FISH_STAMINA + FISH_TIMEOUT:
                if not self.isOutLeveled():
                    next_time = [0, 0]
            elif random.random() <= ATTACK_CHANCE:
                self.super_attack = True
            elif self.time < FISH_STAMINA and not self.isOutLeveled():
                delta = (self.time - FISH_STAMINA)
                penalty = delta / FISH_TIMEOUT * next_time[1]
                next_time[1] = next_time[1] - penalty
        else:
            self.super_attack = False
            next_time = REST_TIME
        self.phase_duration = random.uniform(next_time[0], next_time[1])
        self.phase_duration = 6 if self.super_attack else self.phase_duration
        
    def tryPhaseSwitch(self, dt):
        self.phase_time += dt
        if self.phase_time >= self.phase_duration:
            phase = "REST" if self.phase == "STRUGGLE" else "STRUGGLE"
            self.setPhase(phase)

    def getDelta(self, bonus = 0):
        speed_delta = (self.fish_speed + bonus) - self.drag
        growth = OUT_LEVELED if self.isOutLeveled() else SPEED_GROWTH
        if self.isOutLeveled():
            speed = 40
        else:
            speed = BASE_SPEED * pow(growth , speed_delta) 
        speed = max(MIN_SPEED, speed)

        reel_delta = self.reel_str - (self.fish_str + bonus)
        reel = BASE_REEL * pow(growth, reel_delta)
        if self.isOutLeveled():
            reel = 20
        return speed, reel
    
    def getStruggle(self, dt) -> float:
        bonus = 10 if self.super_attack else 0
        (speed, reel) = self.getDelta(bonus)
        if self.tension < self.line_hp:
        # if False:
            distance = speed - reel
            self.tension += (self.fish_str + bonus) * dt
        else:
            distance = speed
        return distance * dt

    def getRest(self, dt) -> float:
        (speed, reel) = self.getDelta()
        return max(-MAX_REEL, speed - reel) * dt

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
        title = f"Win: {wins * 100 // len(results)}% | Avg Time: {avg_time:.1f}s | Drag {DRAG} | STR {REEL_STR} "
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


def plot_sweep(sweep_data: dict[int, list[list[FrameRecord]]], param_name: str):
    fig, ax = plt.subplots(figsize=(14, 7))

    values = sorted(sweep_data.keys())
    norm = mcolors.Normalize(vmin=min(values), vmax=max(values))
    cmap = cm.viridis

    for val in values:
        color = cmap(norm(val))
        for i, history in enumerate(sweep_data[val]):
            times = [r.time for r in history]
            distances = [r.line_distance for r in history]
            ax.plot(times, distances, color=color, linewidth=0.8, alpha=0.35,
                    label=f"{param_name}={val}" if i == 0 else None)

    ax.axhline(0, linestyle="--", color="green", alpha=0.5, linewidth=0.8)
    ax.axhline(MAX_DISTANCE, linestyle="--", color="red", alpha=0.5, linewidth=0.8)
    ax.set_ylabel("Line Distance")
    ax.set_xlabel("Time (s)")
    ax.set_ylim(0, MAX_DISTANCE + 0.1)
    ax.set_title(
        f"Line Distance by {param_name} [{min(values)}..{max(values)}]  "
        f"(fish_spd={FISH_SPEED}, fish_str={FISH_STRENGTH}, {NUM_TRIALS} trials each)",
        fontsize=13,
    )

    sm = cm.ScalarMappable(cmap=cmap, norm=norm)
    sm.set_array([])
    fig.colorbar(sm, ax=ax, label=param_name)

    plt.tight_layout()
    plt.show()


def _draw_heatmap(fig, ax, data, reel_vals, drag_vals, title, cmap,
                  fmt, win_data=None, low_win_threshold=25,
                  highlight_col=None, highlight_row=None, **imshow_kw):
    im = ax.imshow(data, cmap=cmap, aspect="auto", origin="lower", **imshow_kw)
    ax.set_xticks(range(len(reel_vals)))
    ax.set_xticklabels(reel_vals)
    ax.set_yticks(range(len(drag_vals)))
    ax.set_yticklabels(drag_vals)
    ax.set_xlabel("reel_str")
    ax.set_ylabel("drag")
    ax.set_title(title)
    fig.colorbar(im, ax=ax)

    for di in range(len(drag_vals)):
        for ri in range(len(reel_vals)):
            val = data[di, ri]
            if win_data is None:
                color = "black" if 30 < val < 70 else "white"
            else:
                color = "white"
            ax.text(ri, di, f"{val:{fmt}}", ha="center", va="center",
                    fontsize=7, color=color)
            if win_data is not None and win_data[di, ri] < low_win_threshold:
                ax.add_patch(plt.Rectangle(
                    (ri - 0.5, di - 0.5), 1, 1,
                    fill=False, edgecolor="red", linewidth=1.5, linestyle="--"))

    if highlight_col is not None and highlight_col in reel_vals:
        col = reel_vals.index(highlight_col)
        ax.axvline(col - 0.5, color="white", linewidth=2, linestyle="--")
        ax.axvline(col + 0.5, color="white", linewidth=2, linestyle="--")
    if highlight_row is not None and highlight_row in drag_vals:
        row = drag_vals.index(highlight_row)
        ax.axhline(row - 0.5, color="white", linewidth=2, linestyle="--")
        ax.axhline(row + 0.5, color="white", linewidth=2, linestyle="--")


def plot_grid(grid_results: dict[tuple[int, int], list[tuple]]):
    reel_vals = sorted(set(r for r, _ in grid_results.keys()))
    drag_vals = sorted(set(d for _, d in grid_results.keys()))

    win_data = np.zeros((len(drag_vals), len(reel_vals)))
    time_data = np.zeros((len(drag_vals), len(reel_vals)))
    p50_data = np.zeros((len(drag_vals), len(reel_vals)))
    p99_data = np.zeros((len(drag_vals), len(reel_vals)))

    for di, drag in enumerate(drag_vals):
        for ri, reel in enumerate(reel_vals):
            rs = grid_results[(reel, drag)]
            times = sorted(t for _, t in rs)
            wins = sum(1 for r, _ in rs if r == "WIN")
            win_data[di, ri] = wins * 100 / len(rs)
            time_data[di, ri] = statistics.mean(times)
            if len(times) >= 2:
                quantiles = statistics.quantiles(times, n=100)
                p50_data[di, ri] = quantiles[49]
                p99_data[di, ri] = quantiles[98]
            else:
                p50_data[di, ri] = times[0]
                p99_data[di, ri] = times[0]

    fig, ((ax_win, ax_time), (ax_p50, ax_p90)) = plt.subplots(2, 2, figsize=(16, 14))
    heatmap_kw = dict(reel_vals=reel_vals, drag_vals=drag_vals,
                      highlight_col=FISH_STRENGTH, highlight_row=FISH_SPEED)

    _draw_heatmap(fig, ax_win, win_data, **heatmap_kw,
                  title="Win %", cmap="RdYlGn", fmt=".0f", vmin=0, vmax=100)
    _draw_heatmap(fig, ax_time, time_data, **heatmap_kw,
                  title="Avg Time (s)", cmap="viridis", fmt=".1f", win_data=win_data)
    _draw_heatmap(fig, ax_p50, p50_data, **heatmap_kw,
                  title="P50 Time (s)", cmap="viridis", fmt=".1f", win_data=win_data)
    _draw_heatmap(fig, ax_p90, p99_data, **heatmap_kw,
                  title="P99 Time (s)", cmap="viridis", fmt=".1f", win_data=win_data)

    fig.suptitle(
        f"2D Sweep: reel_str vs drag  (fish_spd={FISH_SPEED}, fish_str={FISH_STRENGTH}, {NUM_TRIALS} trials)",
        fontsize=13,
    )
    plt.tight_layout()
    plt.show()


def _run_trials(sim: Fight, n: int, keep_history=False):
    histories = []
    results = []
    for _ in range(n):
        result = sim.run()
        if keep_history:
            histories.append(list(sim.history))
        results.append(result)
        sim.reset()
    return histories, results


def _print_summary(results: list[tuple]):
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


if __name__ == "__main__":
    base_kwargs = dict(fish_speed=FISH_SPEED, fish_strength=FISH_STRENGTH,
                       reel_str=REEL_STR, drag=DRAG, line_hp=LINE_HP)

    if SWEEP_PARAM == "none":
        sim = Fight(**base_kwargs)
        histories, results = _run_trials(sim, NUM_TRIALS, keep_history=True)
        _print_summary(results)
        plot(histories, results)

    elif SWEEP_PARAM == "both":
        grid_results: dict[tuple[int, int], list[tuple]] = {}
        for reel_val in SWEEP_RANGE:
            for drag_val in SWEEP_RANGE:
                kwargs = {**base_kwargs, "reel_str": reel_val, "drag": drag_val}
                sim = Fight(**kwargs)
                _, results = _run_trials(sim, NUM_TRIALS)
                grid_results[(reel_val, drag_val)] = results

        plot_grid(grid_results)

    else:
        sweep_data: dict[int, list[list[FrameRecord]]] = {}
        sweep_results: dict[int, list[tuple]] = {}

        for val in SWEEP_RANGE:
            kwargs = {**base_kwargs, SWEEP_PARAM: val}
            sim = Fight(**kwargs)
            histories, results = _run_trials(sim, NUM_TRIALS, keep_history=True)
            sweep_data[val] = histories
            sweep_results[val] = results

        if len(SWEEP_RANGE) == 1:
            val = list(SWEEP_RANGE)[0]
            _print_summary(sweep_results[val])
            plot(sweep_data[val], sweep_results[val])
        else:
            print(f"\n{SWEEP_PARAM:<15} {'Win %':>8} {'Avg Time':>10}")
            print(f"{'-'*15} {'-'*8} {'-'*10}")
            for val in sorted(sweep_results):
                rs = sweep_results[val]
                wins = sum(1 for r, _ in rs if r == "WIN")
                avg_t = statistics.mean(t for _, t in rs)
                print(f"{val:<15} {wins * 100 / len(rs):>7.0f}% {avg_t:>9.1f}s")

            plot_sweep(sweep_data, SWEEP_PARAM)
