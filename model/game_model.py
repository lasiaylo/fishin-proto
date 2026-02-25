import csv
import os
import sys

import matplotlib.pyplot as plt

from fight_sim import Fight

# ── Simulation constants ──
SHOP_TRAVEL_TIME = 10  # seconds, one way
CAST_WAIT_TIME = 5     # seconds per cast
DATA_DIR = os.path.join("/Users/lasialo/Documents/Workspace/Unity/Fishin2/Fishin2/Assets/Data/")
def load_fish_data(csv_path: str) -> list[dict]:
    fish = []
    with open(csv_path) as f:
        reader = csv.reader(f)
        next(reader)  # skip header
        for row in reader:
            parts = [s.strip() for s in row]
            if not parts or not parts[0]:
                continue
            fish.append({
                "id": parts[0],
                "name": parts[1],
                "basePrice": int(parts[2]),
                "baseWeight": float(parts[3]),
                "strength": float(parts[4]),
                "speed": float(parts[5]),
                "requiredLure": parts[6] if len(parts) > 6 and parts[6] else None,
            })
    return fish


def load_shop_data(csv_path: str) -> list[dict]:
    upgrades = []
    with open(csv_path) as f:
        reader = csv.reader(f)
        next(reader)  # skip header
        for row in reader:
            parts = [s.strip() for s in row]
            if not parts or not parts[0]:
                continue
            upgrades.append({
                "id": parts[0],
                "prices": [int(p) for p in parts[1].split()],
                "stat": parts[2],
                "valuePerLevel": float(parts[3]),
            })
    return upgrades


def get_available_fish(fish_data: list[dict], owned_lures: set[str]) -> list[dict]:
    return [f for f in fish_data
            if f["requiredLure"] is None or f["requiredLure"] in owned_lures]


def simulate_fight(fish: dict, player: dict) -> tuple[str, float]:
    sim = Fight(
        fish_speed=fish["speed"],
        fish_strength=fish["strength"],
        reel_str=player["reelStrength"],
        drag=player["drag"],
        line_hp=player["lineStrength"],
    )
    return sim.run()


def best_fish(fish_data: list[dict], player: dict,
              owned_lures: set[str]) -> tuple[dict, float] | None:
    """Pick the fish with the best income rate (price / fight_time).
    Returns (fish, fight_duration) or None if no fish is winnable."""
    available = get_available_fish(fish_data, owned_lures)
    best = None
    best_rate = -1
    best_duration = 0
    for f in available:
        outcome, duration = simulate_fight(f, player)
        if outcome != "WIN":
            continue
        rate = f["basePrice"] / duration
        if rate > best_rate:
            best_rate = rate
            best = f
            best_duration = duration
    if best is None:
        return None
    return best, best_duration


def cheapest_upgrade(shop_data: list[dict], upgrade_levels: dict[str, int],
                     wallet: int) -> tuple[dict, int] | None:
    """Return (upgrade, price) for the cheapest affordable upgrade, or None."""
    options = []
    for u in shop_data:
        level = upgrade_levels.get(u["id"], 0)
        if level >= len(u["prices"]):
            continue  # maxed
        price = u["prices"][level]
        if price <= wallet:
            options.append((u, price))
    if not options:
        return None
    return min(options, key=lambda x: x[1])


def apply_upgrade(upgrade: dict, player: dict, owned_lures: set[str],
                  upgrade_levels: dict[str, int]):
    upgrade_levels[upgrade["id"]] = upgrade_levels.get(upgrade["id"], 0) + 1
    stat = upgrade["stat"]
    value = upgrade["valuePerLevel"]
    if stat == "lure":
        owned_lures.add(upgrade["id"])
    elif stat in player:
        player[stat] += value
    else:
        player[stat] = value


def run_simulation():
    fish_data = load_fish_data(os.path.join(DATA_DIR, "FishGameplay.csv"))
    shop_data = load_shop_data(os.path.join(DATA_DIR, "ShopGameplay.csv"))

    player = {
        "reelStrength": 10.0,
        "drag": 1.0,
        "lineStrength": 20.0,
        "inventory": 4,
    }
    owned_lures: set[str] = set()
    upgrade_levels: dict[str, int] = {}
    wallet = 0

    cumulative_time = 0.0
    records = []

    max_rounds = 100
    for round_num in range(1, max_rounds + 1):
        result = best_fish(fish_data, player, owned_lures)
        if result is None:
            print("No fish can be caught with current stats. Stopping.")
            break
        fish, fight_duration = result

        inventory = int(player["inventory"])
        income = inventory * fish["basePrice"]
        round_time = 2 * SHOP_TRAVEL_TIME + inventory * (CAST_WAIT_TIME + fight_duration)
        cumulative_time += round_time
        wallet += income
        rate = income / round_time

        # Buy upgrades
        upgrades_bought = []
        while True:
            result = cheapest_upgrade(shop_data, upgrade_levels, wallet)
            if result is None:
                break
            upgrade, price = result
            wallet -= price
            apply_upgrade(upgrade, player, owned_lures, upgrade_levels)
            upgrades_bought.append(f"{upgrade['id']} L{upgrade_levels[upgrade['id']]}")

        records.append({
            "round": round_num,
            "time": cumulative_time,
            "rate": rate,
            "fish": fish["name"],
            "upgrades": ", ".join(upgrades_bought) if upgrades_bought else "-",
        })

        # Stop if all upgrades maxed
        all_maxed = all(
            upgrade_levels.get(u["id"], 0) >= len(u["prices"])
            for u in shop_data
        )
        if all_maxed:
            break

    return records


def print_table(records: list[dict]):
    header = f"{'Round':>5}  {'Time':>8}  {'$/sec':>8}  {'Fish':<10}  {'Upgrades'}"
    print(header)
    print("-" * len(header))
    for r in records:
        print(f"{r['round']:>5}  {r['time']:>8.1f}  "
              f"{r['rate']:>8.4f}  {r['fish']:<10}  {r['upgrades']}")


def plot_income(records: list[dict]):
    times = [r["time"] for r in records]
    rates = [r["rate"] for r in records]

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(times, rates, marker="o", color="dodgerblue", linewidth=1.5)
    ax.set_xlabel("Cumulative Time (s)")
    ax.set_ylabel("$/sec")
    ax.set_title("Income Rate Over Time")
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    records = run_simulation()
    print_table(records)
    plot_income(records)
