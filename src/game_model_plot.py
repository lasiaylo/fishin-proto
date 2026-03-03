import matplotlib.pyplot as plt


def print_table(records: list[dict]):
    header = f"{'Round':>5}  {'Duration':>8}  {'Fight':>8}  {'Income':>8}  {'Wallet':>8}  {'$/sec':>8}  {'Fish':<10}  {'Upgrades'}"
    print(header)
    print("-" * len(header))
    for r in records:
        print(f"{r['round']:>5}  {r['duration']:>8.1f}  {r['fight_duration']:>8.1f}  {r['income']:>8}  {r['wallet']:>8}  "
              f"{r['rate']:>8g}  {r['fish']:<10}  {r['upgrades']}")


def plot_income(records: list[dict]):
    times = [r["time"] / 60 for r in records]
    rates = [r["rate"] for r in records]

    upgrade_times = [t for t, r in zip(times, records) if r["upgrades"] != "-"]
    upgrade_rates = [r["rate"] for r in records if r["upgrades"] != "-"]

    # Collect all upgrade stat names across rounds
    all_stats = sorted({k for r in records for k in r["upgrade_levels"]})

    fig, (ax_rate, ax_lvl) = plt.subplots(
        2, 1, sharex=True, figsize=(10, 8),
        gridspec_kw={"height_ratios": [3, 1]},
    )
    fig.subplots_adjust(hspace=0.08)

    # ── income rate subplot ──
    ax_rate.plot(times, rates, marker="o", color="dodgerblue", linewidth=1.5)
    ax_rate.scatter(upgrade_times, upgrade_rates, color="red", zorder=5, label="Upgrade")
    for t, r in zip(times, records):
        if r["bought_lure"]:
            ax_rate.axvline(x=t, color="green", linestyle="--", alpha=0.7, label="Lure")
            ax_lvl.axvline(x=t, color="green", linestyle="--", alpha=0.7)
    # Deduplicate legend entries
    handles, labels = ax_rate.get_legend_handles_labels()
    seen = {}
    for h, l in zip(handles, labels):
        if l not in seen:
            seen[l] = h
    ax_rate.legend(seen.values(), seen.keys())
    ax_rate.set_ylabel("$/sec")
    ax_rate.set_title("Income Rate Over Time")
    ax_rate.grid(True, alpha=0.3)

    # ── upgrade levels subplot ──
    for stat in all_stats:
        if stat.startswith("LURE_") or stat == "WIN":
            continue
        levels = [r["upgrade_levels"].get(stat, 0) for r in records]
        ax_lvl.step(times, levels, where="post", linewidth=1.2, label=stat)
    ax_lvl.legend(fontsize=8)
    ax_lvl.set_xlabel("Cumulative Time (min)")
    ax_lvl.set_ylabel("Level")
    ax_lvl.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.show()
