import csv
import os

from fight_sim import Fight

# ── Simulation constants ──
SHOP_TRAVEL_TIME = 5  # seconds, one way
CAST_WAIT_TIME = 5     # seconds per cast
DATA_DIR = os.path.join("/Users/lasialo/Documents/Workspace/Fishin2Model/data")
 
INIT_STRENGTH = 3
INIT_DRAG = 3
INIT_HP = 20.0
INIT_INVENTORY = 4
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
                "strength": float(parts[3]),
                "speed": float(parts[4]),
                "requiredLure": parts[5] if len(parts) > 5 and parts[5] else None,
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


EVAL_TRIALS = 1000  # trials per fish when picking the best target

def simulate_fight(fish: dict, player: dict) -> tuple[str, float]:
    sim = Fight(
        fish_speed=fish["speed"],
        fish_strength=fish["strength"],
        reel_str=player["reelStrength"],
        drag=player["drag"],
        line_hp=player["lineHP"],
    )
    return sim.run()


def most_valuable_fish(fish_data: list[dict], player: dict,
                       owned_lures: set[str]) -> tuple[dict, float] | None:
    """Pick the available fish with the highest base price.
    Returns (fish, avg_fight_duration) or None if no fish is winnable."""
    available = get_available_fish(fish_data, owned_lures)
    candidates = sorted(available, key=lambda f: f["basePrice"], reverse=True)
    for f in candidates:
        wins = 0
        total_time = 0.0
        for _ in range(EVAL_TRIALS):
            outcome, duration = simulate_fight(f, player)
            if outcome == "WIN":
                wins += 1
                total_time += duration
        if wins > 0:
            return f, total_time / wins
    return None

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
        "reelStrength": INIT_STRENGTH,
        "drag": INIT_DRAG,
        "lineHP": INIT_HP,
        "inventory": INIT_INVENTORY,
    }
    owned_lures: set[str] = set()
    upgrade_levels: dict[str, int] = {}
    wallet = 0

    cumulative_time = 0.0
    records = []

    max_rounds = 100
    for round_num in range(1, max_rounds + 1):
        result = most_valuable_fish(fish_data, player, owned_lures)
        if result is None:
            print("No fish can be caught with current stats. Stopping.")
            break
        fish, fight_duration = result

        inventory = int(player["inventory"])
        income = inventory * fish["basePrice"]
        round_time = 2 * SHOP_TRAVEL_TIME + inventory * (CAST_WAIT_TIME + fight_duration)
        cumulative_time += round_time
        wallet += income
        wallet_snapshot = wallet
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
            "duration": round_time,
            "fight_duration": fight_duration,
            "income": income,
            "wallet": wallet_snapshot,
            "rate": rate,
            "fish": fish["name"],
            "upgrades": ", ".join(upgrades_bought) if upgrades_bought else "-",
            "upgrade_levels": dict(upgrade_levels),
        })

        # Stop if all upgrades maxed
        all_maxed = all(
            upgrade_levels.get(u["id"], 0) >= len(u["prices"])
            for u in shop_data
        )
        if all_maxed:
            break

    return records


if __name__ == "__main__":
    from game_model_plot import print_table, plot_income

    records = run_simulation()
    print_table(records)
    plot_income(records)
