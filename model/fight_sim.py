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

REST_TIME = 3.5
FIGHT_TIME = 2
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
        self.phase: str = "STRUGGLE"
        self.time: float = 0.0
        self.phase_time: float = 0.0
        self.history: list[FrameRecord] = []

    def struggle(self, dt):
        if self.tension < self.line_hp:
            distance = (self.fish_speed - max(0, self.reel_str - self.fish_strength))
            self.tension += self.fish_strength * dt
        else:
            distance = self.fish_speed

        self.distance += distance * dt

    def rest(self, dt):
        distance = self.fish_speed / 4 - self.reel_str
        self.distance += distance * dt

    def tryPhaseSwitch(self, dt):
        self.phase_time += dt
        curr_time = FIGHT_TIME if self.phase == "STRUGGLE" else REST_TIME
        if self.phase_time >= curr_time:
            self.phase_time = 0
            self.phase = "REST" if self.phase == "STRUGGLE" else "STRUGGLE"

    def run(self):
        dt = 0.5
        while self.time < MAX_SIM_TIME:
            self.tryPhaseSwitch(dt)
            if self.phase == "STRUGGLE":
                self.struggle(dt)
            else:
                self.rest(dt)

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

def plot(sim: Fight):
    times = [r.time for r in sim.history]
    distances = [r.line_distance for r in sim.history]
    tensions = [r.line_tension for r in sim.history]

    fig, (ax_dist, ax_tens) = plt.subplots(
        2, 1, sharex=True, figsize=(12, 7),
        gridspec_kw={"height_ratios": [3, 1]},
    )
    fig.subplots_adjust(hspace=0.08)

    # ── phase shading ──
    phase_start = 0.0
    prev_phase = sim.history[0].phase
    for r in sim.history:
        if r.phase != prev_phase or r is sim.history[-1]:
            color = "#ff000018" if prev_phase == "STRUGGLE" else "#00ff0018"
            for ax in (ax_dist, ax_tens):
                ax.axvspan(phase_start, r.time - 0.5, color=color)
            phase_start = max(0, r.time - 0.5)
            prev_phase = r.phase

    # ── distance subplot ──
    ax_dist.plot(times, distances, color="dodgerblue", linewidth=1.2)
    ax_dist.axhline(0, linestyle="--", color="green", alpha=0.5, linewidth=0.8)
    ax_dist.axhline(100, linestyle="--", color="red", alpha=0.5, linewidth=0.8)
    ax_dist.set_ylabel("Line Distance")
    ax_dist.set_ylim(-5, 105)

    title = f"Fish"
    ax_dist.set_title(title, fontsize=14)

    # legend
    struggle_patch = mpatches.Patch(color="#ff000030", label="Struggle")
    rest_patch = mpatches.Patch(color="#00ff0030", label="Rest")
    ax_dist.legend(handles=[struggle_patch, rest_patch], loc="upper right")

    # ── tension subplot ──
    ax_tens.plot(times, tensions, color="orangered", linewidth=1.2)
    ax_tens.set_ylabel("Line Tension")
    ax_tens.set_xlabel("Time (s)")

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    sim = Fight(fish_speed=10, fish_strength=5, reel_str=10, drag=1, line_hp=20)
    result = sim.run()[0]
    print(f"{result} at {sim.time:.2f}s  "
          f"(tension {sim.tension:.2f}/{sim.line_hp})")
    plot(sim)
