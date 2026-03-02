import matplotlib.pyplot as plt


def print_table(records: list[dict]):
    header = f"{'Round':>5}  {'Duration':>8}  {'Income':>8}  {'Wallet':>8}  {'$/sec':>8}  {'Fish':<10}  {'Upgrades'}"
    print(header)
    print("-" * len(header))
    for r in records:
        print(f"{r['round']:>5}  {r['duration']:>8.1f}  {r['income']:>8}  {r['wallet']:>8}  "
              f"{r['rate']:>8.4f}  {r['fish']:<10}  {r['upgrades']}")


def plot_income(records: list[dict]):
    times = [r["time"] / 60 for r in records]
    rates = [r["rate"] for r in records]

    upgrade_times = [t for t, r in zip(times, records) if r["upgrades"] != "-"]
    upgrade_rates = [r["rate"] for r in records if r["upgrades"] != "-"]

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(times, rates, marker="o", color="dodgerblue", linewidth=1.5)
    ax.scatter(upgrade_times, upgrade_rates, color="red", zorder=5, label="Upgrade")
    ax.legend()
    ax.set_xlabel("Cumulative Time (min)")
    ax.set_ylabel("$/sec")
    ax.set_title("Income Rate Over Time")
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.show()
