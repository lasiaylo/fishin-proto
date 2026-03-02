import random
import statistics
from dataclasses import dataclass
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
LINE_HP = 50

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


def main():
    from fight_plot import plot, plot_sweep, plot_grid
    base_kwargs = dict(fish_speed=FISH_SPEED, fish_strength=FISH_STRENGTH,
                       reel_str=REEL_STR, drag=DRAG, line_hp=LINE_HP)

    if SWEEP_PARAM == "none":
        sim = Fight(**base_kwargs)
        histories, results = _run_trials(sim, NUM_TRIALS, keep_history=True)
        _print_summary(results)
        plot (histories, results)
        return

    if SWEEP_PARAM == "both":
        grid_results: dict[tuple[int, int], list[tuple]] = {}
        for reel_val in SWEEP_RANGE:
            for drag_val in SWEEP_RANGE:
                kwargs = {**base_kwargs, "reel_str": reel_val, "drag": drag_val}
                sim = Fight(**kwargs)
                _, results = _run_trials(sim, NUM_TRIALS)
                grid_results[(reel_val, drag_val)] = results
        plot_grid(grid_results, False)
        return

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
        plot (sweep_data[val], sweep_results[val])
        return
    
    print(f"\n{SWEEP_PARAM:<15} {'Win %':>8} {'Avg Time':>10}")
    print(f"{'-'*15} {'-'*8} {'-'*10}")
    for val in sorted(sweep_results):
        rs = sweep_results[val]
        wins = sum(1 for r, _ in rs if r == "WIN")
        avg_t = statistics.mean(t for _, t in rs)
        print(f"{val:<15} {wins * 100 / len(rs):>7.0f}% {avg_t:>9.1f}s")

    plot_sweep(sweep_data, SWEEP_PARAM)

if __name__ == "__main__":
    main()