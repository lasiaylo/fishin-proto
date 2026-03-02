import statistics

import numpy as np
import matplotlib.cm as cm
import matplotlib.colors as mcolors
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt

from fight_sim import (
    MAX_DISTANCE, LINE_HP, DRAG, REEL_STR,
    FISH_SPEED, FISH_STRENGTH, NUM_TRIALS,
    FrameRecord,
)


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


def plot_grid(grid_results: dict[tuple[int, int], list[tuple]], show_percentiles=True):
    reel_vals = sorted(set(r for r, _ in grid_results.keys()))
    drag_vals = sorted(set(d for _, d in grid_results.keys()))

    win_data = np.zeros((len(drag_vals), len(reel_vals)))
    time_data = np.zeros((len(drag_vals), len(reel_vals)))

    for di, drag in enumerate(drag_vals):
        for ri, reel in enumerate(reel_vals):
            rs = grid_results[(reel, drag)]
            times = sorted(t for _, t in rs)
            wins = sum(1 for r, _ in rs if r == "WIN")
            win_data[di, ri] = wins * 100 / len(rs)
            time_data[di, ri] = statistics.mean(times)

    heatmap_kw = dict(reel_vals=reel_vals, drag_vals=drag_vals,
                      highlight_col=FISH_STRENGTH, highlight_row=FISH_SPEED)

    if show_percentiles:
        p50_data = np.zeros((len(drag_vals), len(reel_vals)))
        p99_data = np.zeros((len(drag_vals), len(reel_vals)))
        for di, drag in enumerate(drag_vals):
            for ri, reel in enumerate(reel_vals):
                times = sorted(t for _, t in grid_results[(reel, drag)])
                if len(times) >= 2:
                    quantiles = statistics.quantiles(times, n=100)
                    p50_data[di, ri] = quantiles[49]
                    p99_data[di, ri] = quantiles[98]
                else:
                    p50_data[di, ri] = times[0]
                    p99_data[di, ri] = times[0]

        fig, ((ax_win, ax_time), (ax_p50, ax_p90)) = plt.subplots(2, 2, figsize=(16, 14))
        _draw_heatmap(fig, ax_p50, p50_data, **heatmap_kw,
                      title="P50 Time (s)", cmap="viridis", fmt=".1f", win_data=win_data)
        _draw_heatmap(fig, ax_p90, p99_data, **heatmap_kw,
                      title="P99 Time (s)", cmap="viridis", fmt=".1f", win_data=win_data)
    else:
        fig, (ax_win, ax_time) = plt.subplots(1, 2, figsize=(16, 7))

    _draw_heatmap(fig, ax_win, win_data, **heatmap_kw,
                  title="Win %", cmap="RdYlGn", fmt=".0f", vmin=0, vmax=100)
    _draw_heatmap(fig, ax_time, time_data, **heatmap_kw,
                  title="Avg Time (s)", cmap="viridis", fmt=".1f", win_data=win_data)

    fig.suptitle(
        f"2D Sweep: reel_str vs drag  (fish_spd={FISH_SPEED}, fish_str={FISH_STRENGTH}, {NUM_TRIALS} trials)",
        fontsize=13,
    )
    plt.tight_layout()
    plt.show()
