import React, { useEffect, useRef, useState } from "react";
import { Flex, Text, Table, Button, SegmentedControl } from "@radix-ui/themes";
import { csvToRounds } from "../../util/roundSerializer";
import { Line, ReferenceArea, ReferenceLine, Legend } from "recharts";
import { simulateEconomy, type EconomyRound } from "../../game/EconomyModel";
import {
  levelStat,
  StatName,
  loadFishData,
  loadFishDisplayMap,
  loadShopGameplayData,
  parseFishGameplayRows,
  parseShopGameplayRows,
} from "../../util/csvLoader";
import type {
  FishData,
  LocationFishEntry,
  RodData,
  ShopUpgradeData,
} from "../../util/csvLoader";
import { ChartGrid, COLORS, NumInput } from "./shared";
import { FISH_CSVS, SHOP_CSVS } from "../../stores/csvConfigStore";
import {
  CsvGeneratorPanel,
  GENERATED_FISH_CSV,
  GENERATED_SHOP_CSV,
} from "./CsvGenerator";
import { EconomyChart, lineProps } from "./EconomyChart";
import { CsvPair, newPairId, PairRow } from "./PairRow";
import { DEFAULT_UPGRADE_STRATEGY } from "../../game/EconomyModel";
import { INITIAL_PLAYER_STATE } from "../../util/constants";

// ── Helpers ──

function getLureBoughtName(round: EconomyRound, lureSet: Set<string>): string {
  for (const entry of round.upgradesBought) {
    const match = entry.match(/^(.+) L\d+$/);
    if (match && lureSet.has(match[1])) return match[1].replace(/^LURE_/i, "");
  }
  return "";
}

// ── Types ──

interface PairData {
  fish: FishData[];
  shop: ShopUpgradeData[];
}

function buildLureRows(
  rounds: EconomyRound[],
  shopData: ShopUpgradeData[],
): { name: string; cost: number; timeSincePrev: number }[] {
  const lureShopMap = Object.fromEntries(
    shopData.filter((u) => u.stat === StatName.LURE).map((u) => [u.id, u]),
  );
  const rows: { name: string; cost: number; timeSincePrev: number }[] = [];
  let lastLureTime: number | null = null;
  for (const r of rounds) {
    if (!r.boughtLure) continue;
    for (const entry of r.upgradesBought) {
      const match = entry.match(/^(.+) L(\d+)$/);
      if (!match) continue;
      const [, id, levelStr] = match;
      const upgrade = lureShopMap[id];
      if (!upgrade) continue;
      const level = parseInt(levelStr, 10);
      rows.push({
        name: upgrade.id,
        cost: upgrade.prices[level - 1],
        timeSincePrev:
          lastLureTime !== null
            ? r.cumulativeTime - lastLureTime
            : r.cumulativeTime,
      });
      lastLureTime = r.cumulativeTime;
    }
  }
  return rows;
}

// ── Pair persistence ──

const PAIRS_STORAGE_KEY = "economy-pairs";

function loadStoredPairs(): CsvPair[] | null {
  try {
    const raw = localStorage.getItem(PAIRS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.map((p: Partial<CsvPair>) => ({
      id: newPairId(),
      fishCSV: p.fishCSV ?? FISH_CSVS[0] ?? "FishGameplay.csv",
      shopCSV: p.shopCSV ?? SHOP_CSVS[0] ?? "ShopGameplay.csv",
      label: p.label ?? "Default",
      upgradeStrategy: p.upgradeStrategy ?? DEFAULT_UPGRADE_STRATEGY,
    }));
  } catch {
    return null;
  }
}

// ── EconomyTab ──

export function EconomyTab({
  locationData,
  rodData,
  generatedFishRows,
  generatedShopRows,
  onFishRowsChange,
  onShopRowsChange,
}: {
  locationData: LocationFishEntry[];
  rodData: RodData[];
  generatedFishRows: string[][] | null;
  generatedShopRows: string[][] | null;
  onFishRowsChange: (rows: string[][]) => void;
  onShopRowsChange: (rows: string[][]) => void;
}) {
  const [lineHP, setLineHP] = useState(() =>
    levelStat(rodData.find((r) => r.id === "ROD_1")?.lineHpLevels ?? [], 0),
  );
  const [inventorySize, setInventorySize] = useState(
    INITIAL_PLAYER_STATE.inventorySize,
  );
  const [simMinutes, setSimMinutes] = useState(10);
  const [evalTrials, setEvalTrials] = useState(100);
  const [running, setRunning] = useState(false);

  const [mode, setMode] = useState<"simulation" | "recorded">("simulation");
  const [recordedRounds, setRecordedRounds] = useState<EconomyRound[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV pairs
  const [pairs, setPairs] = useState<CsvPair[]>(
    () =>
      loadStoredPairs() ?? [
        {
          id: newPairId(),
          fishCSV: FISH_CSVS[0] ?? "FishGameplay.csv",
          shopCSV: SHOP_CSVS[0] ?? "ShopGameplay.csv",
          label: "Default",
          upgradeStrategy: DEFAULT_UPGRADE_STRATEGY,
        },
      ],
  );

  useEffect(() => {
    localStorage.setItem(PAIRS_STORAGE_KEY, JSON.stringify(pairs));
  }, [pairs]);
  const [pairData, setPairData] = useState<Record<string, PairData>>({});
  const [pairRounds, setPairRounds] = useState<Record<string, EconomyRound[]>>(
    {},
  );

  // Load data for each pair that doesn't have it yet
  useEffect(() => {
    for (const pair of pairs) {
      if (pairData[pair.id]) continue;
      const fishIsGenerated = pair.fishCSV === GENERATED_FISH_CSV;
      const shopIsGenerated = pair.shopCSV === GENERATED_SHOP_CSV;
      if (fishIsGenerated && !generatedFishRows) continue;
      if (shopIsGenerated && !generatedShopRows) continue;
      const fishPromise = fishIsGenerated
        ? loadFishDisplayMap().then((displayMap) =>
            parseFishGameplayRows(generatedFishRows!, displayMap),
          )
        : loadFishData(pair.fishCSV);
      const shopPromise = shopIsGenerated
        ? Promise.resolve(parseShopGameplayRows(generatedShopRows!))
        : loadShopGameplayData(pair.shopCSV);
      Promise.all([fishPromise, shopPromise]).then(([fish, shop]) => {
        setPairData((prev) => ({ ...prev, [pair.id]: { fish, shop } }));
      });
    }
  }, [pairs, pairData, generatedFishRows, generatedShopRows]);

  // Invalidate cached data for generated pairs when generated rows change
  useEffect(() => {
    const affected = pairs.filter((p) => p.fishCSV === GENERATED_FISH_CSV);
    if (affected.length === 0) return;
    setPairData((prev) => {
      const next = { ...prev };
      for (const p of affected) delete next[p.id];
      return next;
    });
    setPairRounds((prev) => {
      const next = { ...prev };
      for (const p of affected) delete next[p.id];
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedFishRows]);

  useEffect(() => {
    const affected = pairs.filter((p) => p.shopCSV === GENERATED_SHOP_CSV);
    if (affected.length === 0) return;
    setPairData((prev) => {
      const next = { ...prev };
      for (const p of affected) delete next[p.id];
      return next;
    });
    setPairRounds((prev) => {
      const next = { ...prev };
      for (const p of affected) delete next[p.id];
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedShopRows]);

  function handleGeneratorOpenChange(isOpen: boolean) {
    if (isOpen) {
      setPairs((prev) => {
        if (
          prev.some(
            (p) =>
              p.fishCSV === GENERATED_FISH_CSV &&
              p.shopCSV === GENERATED_SHOP_CSV,
          )
        )
          return prev;
        return [
          ...prev,
          {
            id: newPairId(),
            fishCSV: GENERATED_FISH_CSV,
            shopCSV: GENERATED_SHOP_CSV,
            label: "Generated",
          },
        ];
      });
    }
  }

  function addPair() {
    setPairs((prev) => [
      ...prev,
      {
        id: newPairId(),
        fishCSV: FISH_CSVS[0] ?? "FishGameplay.csv",
        shopCSV: SHOP_CSVS[0] ?? "ShopGameplay.csv",
        label: `Pair ${prev.length + 1}`,
        upgradeStrategy: DEFAULT_UPGRADE_STRATEGY,
      },
    ]);
  }

  function removePair(id: string) {
    setPairs((prev) => prev.filter((p) => p.id !== id));
    setPairData((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    setPairRounds((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }

  function updatePair(id: string, patch: Partial<Omit<CsvPair, "id">>) {
    setPairs((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    if (patch.fishCSV !== undefined || patch.shopCSV !== undefined) {
      setPairData((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      setPairRounds((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  }

  const allPairsLoaded = pairs.every((p) => {
    if (p.fishCSV === GENERATED_FISH_CSV && !generatedFishRows) return false;
    if (p.shopCSV === GENERATED_SHOP_CSV && !generatedShopRows) return false;
    return pairData[p.id] !== undefined;
  });

  // Primary pair — used for single-series charts
  const primaryData = pairData[pairs[0]?.id];
  const primaryFishData = primaryData?.fish ?? [];
  const primaryShopData = primaryData?.shop ?? [];

  function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRecordedRounds(csvToRounds(ev.target?.result as string));
      setMode("recorded");
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function runSim() {
    setRunning(true);
    setTimeout(() => {
      const results: Record<string, EconomyRound[]> = {};
      for (const pair of pairs) {
        const data = pairData[pair.id];
        if (!data) continue;
        const rodDataForSim = rodData.map((r) =>
          r.id === "ROD_1" ? { ...r, lineHpLevels: [lineHP] } : r,
        );
        results[pair.id] = simulateEconomy(
          data.fish,
          data.shop,
          locationData,
          { inventorySize, incomeBoostPercent: 0 },
          simMinutes,
          evalTrials,
          pair.upgradeStrategy,
          undefined,
          rodDataForSim,
        );
      }
      setPairRounds(results);
      setRunning(false);
    }, 0);
  }

  // Rounds for single-series charts (primary pair or recorded)
  const primaryRounds =
    mode === "recorded" ? recordedRounds : (pairRounds[pairs[0]?.id] ?? []);

  // All pair results for multi-series Income Rate charts
  const activePairResults =
    mode === "recorded"
      ? [
          {
            pair: {
              id: "recorded",
              label: "Recorded",
              fishCSV: "",
              shopCSV: "",
            },
            rounds: recordedRounds,
          },
        ]
      : pairs
          .map((p) => ({ pair: p, rounds: pairRounds[p.id] ?? [] }))
          .filter((r) => r.rounds.length > 0);

  const hasResults = activePairResults.some((r) => r.rounds.length > 0);

  // ── Chart data (primary rounds) ──

  const multiMaxTime = Math.max(
    0,
    ...activePairResults.map((r) =>
      r.rounds.length > 0 ? r.rounds[r.rounds.length - 1].cumulativeTime : 0,
    ),
  );
  const xTicks = Array.from(
    { length: Math.floor(multiMaxTime / 60) + 1 },
    (_, i) => i * 60,
  );
  const maxRound = Math.max(
    0,
    ...activePairResults.map((r) => r.rounds.length),
  );

  const catchTimeData = primaryRounds.map((r) => ({
    time: r.cumulativeTime,
    ...Object.fromEntries(
      primaryFishData.map((f) => [f.id, r.fishCatchTimes[f.id] ?? null]),
    ),
  }));

  const earningsData = primaryRounds.map((r) => ({
    time: r.cumulativeTime,
    ...Object.fromEntries(
      primaryFishData.map((f) => [
        `${f.id}_earn`,
        r.fishEarnings[f.id] ?? null,
      ]),
    ),
  }));

  const playerStatData = primaryRounds.map((r) => ({
    time: r.cumulativeTime,
    attack: r.rodStats[0]?.attack ?? 0,
    defense: r.rodStats[0]?.defense ?? 0,
    lineHP: r.rodStats[0]?.lineHP ?? 0,
  }));

  const lureRateData = primaryRounds.map((r) => ({
    time: r.cumulativeTime,
    ...Object.fromEntries(Object.entries(r.lureRates)),
  }));

  const lureWinRateData = primaryRounds.map((r) => ({
    time: r.cumulativeTime,
    ...Object.fromEntries(
      Object.entries(r.lureWinRates).map(([id, wr]) => [
        id,
        parseFloat((wr * 100).toFixed(2)),
      ]),
    ),
  }));

  const lureRemainingHPData = primaryRounds.map((r) => ({
    time: r.cumulativeTime,
    ...Object.fromEntries(
      Object.entries(r.lureRemainingHP).map(([id, hp]) => [
        id,
        parseFloat(hp.toFixed(1)),
      ]),
    ),
  }));

  const lureXpAndLevelData = primaryRounds.map((r) => ({
    time: r.cumulativeTime,
    ...Object.fromEntries(
      Object.entries(r.lureXp).map(([k, v]) => [`xp_${k}`, v]),
    ),
    ...Object.fromEntries(
      Object.entries(r.lureLevels).map(([k, v]) => [`lvl_${k}`, v]),
    ),
  }));

  const nonLureUpgrades = primaryShopData.filter(
    (u) => u.stat !== StatName.LURE && u.stat !== StatName.BAIT,
  );

  const levelData = primaryRounds.map((r) => ({
    time: r.cumulativeTime,
    ...Object.fromEntries(
      nonLureUpgrades.map((u) => [u.id, r.upgradeLevels[u.id] ?? 0]),
    ),
  }));

  const lures = [
    ...primaryShopData
      .filter((u) => u.stat === StatName.BAIT)
      .map((u) => ({ id: u.id, name: u.id })),
    ...primaryShopData
      .filter((u) => u.stat === StatName.LURE)
      .map((u) => ({ id: u.id, name: u.id })),
  ];
  const LURE_COLORS = ["#ff6b6b", "#ff922b", "#ffd43b", "#f76707", "#ff4d6d"];
  const BAIT_COLORS = ["#60cdff", "#38d9a9", "#74c0fc", "#4dabf7", "#66d9e8"];
  const lureColorMap = Object.fromEntries(
    lures.map((l, i) => [l.id, LURE_COLORS[i % LURE_COLORS.length]]),
  );
  const lureNameMap = Object.fromEntries(lures.map((l) => [l.id, l.name]));
  const fishColorMap = Object.fromEntries(
    primaryFishData.map((f, i) => [f.id, COLORS[i % COLORS.length]]),
  );

  // Lure regions (primary pair only)
  const lureRegions: { x1: number; x2: number; lureId: string }[] = [];
  if (primaryRounds.length > 0) {
    let regionStart = 0;
    for (let i = 0; i < primaryRounds.length; i++) {
      const r = primaryRounds[i];
      if (
        i === primaryRounds.length - 1 ||
        primaryRounds[i + 1].lureId !== r.lureId
      ) {
        lureRegions.push({
          x1: regionStart,
          x2: r.cumulativeTime,
          lureId: r.lureId,
        });
        regionStart = r.cumulativeTime;
      }
    }
  }
  const lureRegionsByRound: { x1: number; x2: number; lureId: string }[] = [];
  if (primaryRounds.length > 0) {
    let regionStart = primaryRounds[0].round;
    for (let i = 0; i < primaryRounds.length; i++) {
      const r = primaryRounds[i];
      if (
        i === primaryRounds.length - 1 ||
        primaryRounds[i + 1].lureId !== r.lureId
      ) {
        lureRegionsByRound.push({
          x1: regionStart,
          x2: r.round,
          lureId: r.lureId,
        });
        regionStart = r.round;
      }
    }
  }
  const activeLureIds = [...new Set(primaryRounds.map((r) => r.lureId))];

  // Bait regions (secondary rods' bait tackle)
  const activeBaitIds = [
    ...new Set(primaryRounds.map((r) => r.baitId).filter(Boolean)),
  ];
  const baitColorMap = Object.fromEntries(
    activeBaitIds.map((id, i) => [id, BAIT_COLORS[i % BAIT_COLORS.length]]),
  );
  const baitRegions: { x1: number; x2: number; baitId: string }[] = [];
  if (primaryRounds.length > 0) {
    let regionStart = 0;
    for (let i = 0; i < primaryRounds.length; i++) {
      const r = primaryRounds[i];
      if (
        i === primaryRounds.length - 1 ||
        primaryRounds[i + 1].baitId !== r.baitId
      ) {
        if (r.baitId)
          baitRegions.push({
            x1: regionStart,
            x2: r.cumulativeTime,
            baitId: r.baitId,
          });
        regionStart = r.cumulativeTime;
      }
    }
  }
  const baitRegionsByRound: { x1: number; x2: number; baitId: string }[] = [];
  if (primaryRounds.length > 0) {
    let regionStart = primaryRounds[0].round;
    for (let i = 0; i < primaryRounds.length; i++) {
      const r = primaryRounds[i];
      if (
        i === primaryRounds.length - 1 ||
        primaryRounds[i + 1].baitId !== r.baitId
      ) {
        if (r.baitId)
          baitRegionsByRound.push({
            x1: regionStart,
            x2: r.round,
            baitId: r.baitId,
          });
        regionStart = r.round;
      }
    }
  }

  const pairLureIdSets: Record<string, Set<string>> = {};
  for (const { pair } of activePairResults) {
    const shop =
      pair.id === "recorded"
        ? primaryShopData
        : (pairData[pair.id]?.shop ?? primaryShopData);
    pairLureIdSets[pair.id] = new Set(
      shop.filter((u) => u.stat === StatName.LURE).map((u) => u.id),
    );
  }

  const lurePurchaseLinesTime = activePairResults.flatMap(
    ({ pair, rounds }, i) => {
      const lureSet = pairLureIdSets[pair.id] ?? new Set<string>();
      return rounds
        .filter((r) => r.boughtLure)
        .map((r) => (
          <ReferenceLine
            key={`${pair.id}-${r.round}`}
            x={r.cumulativeTime}
            stroke={COLORS[i % COLORS.length]}
            strokeDasharray="4 2"
            label={{
              value: getLureBoughtName(r, lureSet),
              position: "insideTop",
              dx: 14,
              fontSize: 9,
              fill: COLORS[i % COLORS.length],
            }}
          />
        ));
    },
  );
  const lurePurchaseLinesRound = activePairResults.flatMap(
    ({ pair, rounds }, i) => {
      const lureSet = pairLureIdSets[pair.id] ?? new Set<string>();
      return rounds
        .filter((r) => r.boughtLure)
        .map((r) => (
          <ReferenceLine
            key={`${pair.id}-${r.round}`}
            x={r.round}
            stroke={COLORS[i % COLORS.length]}
            strokeDasharray="4 2"
            label={{
              value: getLureBoughtName(r, lureSet),
              position: "insideTop",
              dx: 14,
              fontSize: 9,
              fill: COLORS[i % COLORS.length],
            }}
          />
        ));
    },
  );

  // Single-pair: upgrade dots; multi-pair: omit
  const isSinglePair = activePairResults.length === 1;
  const singlePairRateData = isSinglePair
    ? activePairResults[0].rounds.map((r) => ({
        time: r.cumulativeTime,
        rate: parseFloat(r.rate.toFixed(4)),
        revenue: parseFloat((r.income / r.roundTime).toFixed(4)),
        upgrade:
          r.upgradesBought.length > 0 ? parseFloat(r.rate.toFixed(4)) : null,
        lureLevel: r.lureLevels[r.lureId] ?? 0,
      }))
    : [];
  const singlePairRoundData = isSinglePair
    ? activePairResults[0].rounds.map((r) => ({
        round: r.round,
        income: parseFloat(r.netIncome.toFixed(4)),
        revenue: parseFloat(r.income.toFixed(4)),
        upgrade:
          r.upgradesBought.length > 0
            ? parseFloat(r.netIncome.toFixed(4))
            : null,
        lureLevel: r.lureLevels[r.lureId] ?? 0,
      }))
    : [];

  // ── LurePurchases (multi-pair) ──

  const allPairLureRows = activePairResults.map(({ pair, rounds }) => {
    const shopData =
      pair.id === "recorded"
        ? primaryShopData
        : (pairData[pair.id]?.shop ?? primaryShopData);
    return { pair, rows: buildLureRows(rounds, shopData) };
  });
  const allLureNames = [
    ...new Set(allPairLureRows.flatMap(({ rows }) => rows.map((r) => r.name))),
  ];
  const pairLureMaps = allPairLureRows.map(
    ({ rows }) => new Map(rows.map((r) => [r.name, r.timeSincePrev])),
  );
  const lureCostMap = new Map(
    allPairLureRows.flatMap(({ rows }) => rows.map((r) => [r.name, r.cost])),
  );

  const tripDurationData = primaryRounds.map((r) => ({
    round: r.round,
    duration: parseFloat(r.roundTime.toFixed(2)),
    lureLevel: r.lureLevels[r.lureId] ?? 0,
  }));

  const chartProps = { maxTime: multiMaxTime, xTicks };

  return (
    <Flex direction="column" gap="4" pt="4">
      {/* CSV Pairs */}
      {mode === "simulation" && (
        <Flex direction="column" gap="2">
          {pairs.map((pair, i) => (
            <PairRow
              key={pair.id}
              pair={pair}
              color={COLORS[i % COLORS.length]}
              removable={pairs.length > 1}
              generatedFish={!!generatedFishRows}
              generatedShop={!!generatedShopRows}
              onUpdate={(patch) => updatePair(pair.id, patch)}
              onRemove={() => removePair(pair.id)}
            />
          ))}
          <Button
            size="1"
            variant="soft"
            onClick={addPair}
            style={{ width: "fit-content" }}
          >
            + Add Pair
          </Button>
        </Flex>
      )}
      <CsvGeneratorPanel
        onFishRowsChange={onFishRowsChange}
        onShopRowsChange={onShopRowsChange}
        onOpenChange={handleGeneratorOpenChange}
      />

      {/* Simulation controls */}
      <Flex gap="3" wrap="wrap" align="end">
        <NumInput label="Line HP" value={lineHP} onChange={setLineHP} min={1} />
        <NumInput
          label="Inventory"
          value={inventorySize}
          onChange={setInventorySize}
          min={1}
        />
        <NumInput
          label="Sim minutes"
          value={simMinutes}
          onChange={setSimMinutes}
          min={1}
        />
        <NumInput
          label="Eval trials"
          value={evalTrials}
          onChange={setEvalTrials}
          min={1}
        />
        <Button onClick={runSim} disabled={running || !allPairsLoaded}>
          {running ? "Running…" : !allPairsLoaded ? "Loading…" : "Run Economy"}
        </Button>
      </Flex>

      {/* Mode selector */}
      <Flex gap="3" align="center">
        <SegmentedControl.Root
          value={mode}
          onValueChange={(v) => setMode(v as "simulation" | "recorded")}
          size="1"
        >
          <SegmentedControl.Item value="simulation">
            Simulation
          </SegmentedControl.Item>
          <SegmentedControl.Item value="recorded">
            Recorded
          </SegmentedControl.Item>
        </SegmentedControl.Root>
        {mode === "recorded" && (
          <>
            <Button
              size="1"
              variant="soft"
              onClick={() => fileInputRef.current?.click()}
            >
              Load CSV…
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={handleFileLoad}
            />
          </>
        )}
      </Flex>

      {hasResults && (
        <>
          <Text size="2" color="gray">
            {mode === "recorded"
              ? `${recordedRounds.length} rounds recorded`
              : `${activePairResults.map((r) => `${r.pair.label}: ${r.rounds.length}`).join(" · ")} rounds simulated`}
          </Text>

          <ChartGrid gridLayout={true}>
            {/* Income Rate ($/s) — one line per pair */}
            <EconomyChart
              title="Income Rate ($/s)"
              data={isSinglePair ? singlePairRateData : []}
              tooltipLabelFormatter={(v, payload) => {
                const level = payload?.[0]?.payload?.lureLevel ?? 0;
                return `${(v / 60).toFixed(2)} min · Lure Lvl ${level}`;
              }}
              {...chartProps}
              header={
                isSinglePair
                  ? [
                      ...activeLureIds.map((id) => (
                        <Flex key={`lure-${id}`} align="center" gap="1">
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 2,
                              backgroundColor: lureColorMap[id],
                              opacity: 0.8,
                            }}
                          />
                          <Text size="1" color="gray">
                            {lureNameMap[id]}
                          </Text>
                        </Flex>
                      )),
                      ...activeBaitIds.map((id) => (
                        <Flex key={`bait-${id}`} align="center" gap="1">
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              backgroundColor: baitColorMap[id],
                              opacity: 0.8,
                            }}
                          />
                          <Text size="1" color="gray">
                            {id}
                          </Text>
                        </Flex>
                      )),
                    ]
                  : undefined
              }
            >
              {isSinglePair &&
                lureRegions.map((region, i) => (
                  <ReferenceArea
                    key={i}
                    x1={region.x1}
                    x2={region.x2}
                    fill={lureColorMap[region.lureId]}
                    fillOpacity={0.12}
                    ifOverflow="hidden"
                  />
                ))}
              {isSinglePair &&
                baitRegions.map((region, i) => (
                  <ReferenceArea
                    key={`bait-${i}`}
                    x1={region.x1}
                    x2={region.x2}
                    fill={baitColorMap[region.baitId]}
                    fillOpacity={0.15}
                    ifOverflow="hidden"
                  />
                ))}
              {lurePurchaseLinesTime}
              {isSinglePair ? (
                <>
                  <Line
                    dataKey="rate"
                    stroke={COLORS[0]}
                    {...lineProps}
                    name="Net $/s"
                  />
                  <Line
                    dataKey="revenue"
                    stroke={COLORS[1]}
                    {...lineProps}
                    strokeDasharray="4 2"
                    name="Revenue $/s"
                  />
                  <Line
                    dataKey="upgrade"
                    stroke="#ffd43b"
                    dot={{ fill: "#ffd43b", r: 4 }}
                    strokeWidth={0}
                    isAnimationActive={false}
                    name="upgrade"
                  />
                  <Legend />
                </>
              ) : (
                activePairResults.map((result, i) => (
                  <Line
                    key={result.pair.id}
                    data={result.rounds.map((r) => ({
                      time: r.cumulativeTime,
                      rate: parseFloat(r.rate.toFixed(4)),
                    }))}
                    dataKey="rate"
                    stroke={COLORS[i % COLORS.length]}
                    name={result.pair.label}
                    {...lineProps}
                  />
                ))
              )}
              {!isSinglePair && <Legend />}
            </EconomyChart>

            {/* Income Rate ($/round) — one line per pair */}
            <EconomyChart
              title="Income Rate ($/round)"
              data={isSinglePair ? singlePairRoundData : []}
              maxTime={multiMaxTime}
              xDataKey="round"
              xDomain={[1, maxRound]}
              xTickFormatter={(v) => `${v}`}
              integerXAxis
              syncId="economy-round"
              tooltipLabelFormatter={(v, payload) => {
                const level = payload?.[0]?.payload?.lureLevel ?? 0;
                return `Round ${v} · Lure Lvl ${level}`;
              }}
              header={
                isSinglePair
                  ? [
                      ...activeLureIds.map((id) => (
                        <Flex key={`lure-${id}`} align="center" gap="1">
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 2,
                              backgroundColor: lureColorMap[id],
                              opacity: 0.8,
                            }}
                          />
                          <Text size="1" color="gray">
                            {lureNameMap[id]}
                          </Text>
                        </Flex>
                      )),
                      ...activeBaitIds.map((id) => (
                        <Flex key={`bait-${id}`} align="center" gap="1">
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              backgroundColor: baitColorMap[id],
                              opacity: 0.8,
                            }}
                          />
                          <Text size="1" color="gray">
                            {id}
                          </Text>
                        </Flex>
                      )),
                    ]
                  : undefined
              }
            >
              {isSinglePair &&
                lureRegionsByRound.map((region, i) => (
                  <ReferenceArea
                    key={i}
                    x1={region.x1}
                    x2={region.x2}
                    fill={lureColorMap[region.lureId]}
                    fillOpacity={0.12}
                    ifOverflow="hidden"
                  />
                ))}
              {isSinglePair &&
                baitRegionsByRound.map((region, i) => (
                  <ReferenceArea
                    key={`bait-${i}`}
                    x1={region.x1}
                    x2={region.x2}
                    fill={baitColorMap[region.baitId]}
                    fillOpacity={0.15}
                    ifOverflow="hidden"
                  />
                ))}
              {lurePurchaseLinesRound}
              {isSinglePair ? (
                <>
                  <Line
                    dataKey="income"
                    stroke={COLORS[0]}
                    {...lineProps}
                    name="Net $/round"
                  />
                  <Line
                    dataKey="revenue"
                    stroke={COLORS[1]}
                    {...lineProps}
                    strokeDasharray="4 2"
                    name="Revenue $/round"
                  />
                  <Line
                    dataKey="upgrade"
                    stroke="#ffd43b"
                    dot={{ fill: "#ffd43b", r: 4 }}
                    strokeWidth={0}
                    isAnimationActive={false}
                    name="upgrade"
                  />
                  <Legend />
                </>
              ) : (
                activePairResults.map((result, i) => (
                  <Line
                    key={result.pair.id}
                    data={result.rounds.map((r) => ({
                      round: r.round,
                      income: parseFloat(r.income.toFixed(4)),
                    }))}
                    dataKey="income"
                    stroke={COLORS[i % COLORS.length]}
                    name={result.pair.label}
                    {...lineProps}
                  />
                ))
              )}
              {!isSinglePair && <Legend />}
            </EconomyChart>

            {/* Trip Duration */}
            <EconomyChart
              title="Trip Duration (s/round)"
              data={isSinglePair ? tripDurationData : []}
              xDataKey="round"
              xDomain={[1, maxRound]}
              xTickFormatter={(v) => `${v}`}
              integerXAxis
              syncId="economy-round"
              tooltipLabelFormatter={(v, payload) => {
                const level = payload?.[0]?.payload?.lureLevel ?? 0;
                return `Round ${v} · Lure Lvl ${level}`;
              }}
            >
              {isSinglePair &&
                lureRegionsByRound.map((region, i) => (
                  <ReferenceArea
                    key={i}
                    x1={region.x1}
                    x2={region.x2}
                    fill={lureColorMap[region.lureId]}
                    fillOpacity={0.12}
                    ifOverflow="hidden"
                  />
                ))}
              {isSinglePair &&
                baitRegionsByRound.map((region, i) => (
                  <ReferenceArea
                    key={`bait-${i}`}
                    x1={region.x1}
                    x2={region.x2}
                    fill={baitColorMap[region.baitId]}
                    fillOpacity={0.15}
                    ifOverflow="hidden"
                  />
                ))}
              {lurePurchaseLinesRound}
              {isSinglePair ? (
                <Line
                  dataKey="duration"
                  stroke={COLORS[0]}
                  {...lineProps}
                  name="s/round"
                />
              ) : (
                activePairResults.map((result, i) => (
                  <Line
                    key={result.pair.id}
                    data={result.rounds.map((r) => ({
                      round: r.round,
                      duration: parseFloat(r.roundTime.toFixed(2)),
                    }))}
                    dataKey="duration"
                    stroke={COLORS[i % COLORS.length]}
                    name={result.pair.label}
                    {...lineProps}
                  />
                ))
              )}
              {!isSinglePair && <Legend />}
            </EconomyChart>

            {/* Lure Purchases — multi-column */}
            {allLureNames.length > 0 && (
              <Flex direction="column" gap="2">
                <Text size="2" weight="bold">
                  Lure Purchases
                </Text>
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Lure</Table.ColumnHeaderCell>
                      {isSinglePair && (
                        <Table.ColumnHeaderCell>
                          Cost ($)
                        </Table.ColumnHeaderCell>
                      )}
                      {activePairResults.map((r) => (
                        <Table.ColumnHeaderCell key={r.pair.id}>
                          {(isSinglePair && `Time Since Prev (s)`) ||
                            (!isSinglePair && `${r.pair.label}`)}
                        </Table.ColumnHeaderCell>
                      ))}
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {allLureNames.map((name) => (
                      <Table.Row key={name}>
                        <Table.Cell>{name}</Table.Cell>
                        {isSinglePair && (
                          <Table.Cell>
                            {lureCostMap.get(name) ?? "—"}
                          </Table.Cell>
                        )}
                        {pairLureMaps.map((map, i) => (
                          <Table.Cell key={i}>
                            {map.has(name) ? Math.round(map.get(name)!) : "—"}
                          </Table.Cell>
                        ))}
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Flex>
            )}

            {isSinglePair && (
              <EconomyChart
                title="Lure Income Rates ($/s)"
                data={lureRateData}
                {...chartProps}
              >
                <Legend />
                {lures.map((l) => (
                  <Line
                    key={l.id}
                    dataKey={l.id}
                    stroke={lureColorMap[l.id]}
                    {...lineProps}
                    name={l.name}
                    connectNulls={false}
                  />
                ))}
              </EconomyChart>
            )}

            {isSinglePair && (
              <EconomyChart
                title="Lure Win % by Lure"
                data={lureWinRateData}
                {...chartProps}
              >
                <Legend />
                {lures.map((l) => (
                  <Line
                    key={l.id}
                    dataKey={l.id}
                    stroke={lureColorMap[l.id]}
                    {...lineProps}
                    name={l.name}
                    connectNulls={false}
                  />
                ))}
              </EconomyChart>
            )}

            {isSinglePair && (
              <EconomyChart
                title="Avg Remaining Line HP by Lure (%)"
                data={lureRemainingHPData}
                {...chartProps}
              >
                <Legend />
                {lures.map((l) => (
                  <Line
                    key={l.id}
                    dataKey={l.id}
                    stroke={lureColorMap[l.id]}
                    {...lineProps}
                    name={l.name}
                    connectNulls={false}
                  />
                ))}
              </EconomyChart>
            )}


            {isSinglePair && (
              <EconomyChart
                title="Upgrade Levels"
                data={levelData}
                {...chartProps}
                integerYAxis
              >
                {lurePurchaseLinesTime}
                <Legend />
                {nonLureUpgrades.map((u, i) => (
                  <Line
                    key={u.id}
                    dataKey={u.id}
                    type="stepAfter"
                    stroke={COLORS[i % COLORS.length]}
                    {...lineProps}
                    name={u.id}
                  />
                ))}
              </EconomyChart>
            )}

            {isSinglePair && lures.filter((l) => l.id !== "").length > 0 && (
              <EconomyChart
                title="Lure XP / Level"
                data={lureXpAndLevelData}
                {...chartProps}
                integerYAxis
                integerRightYAxis
              >
                {lurePurchaseLinesTime}
                <Legend />
                {lures
                  .filter((l) => l.id !== "")
                  .map((l) => (
                    <Line
                      key={`xp_${l.id}`}
                      dataKey={`xp_${l.id}`}
                      yAxisId="left"
                      stroke={lureColorMap[l.id]}
                      {...lineProps}
                      name={l.name}
                    />
                  ))}
                {lures
                  .filter((l) => l.id !== "")
                  .map((l) => (
                    <Line
                      key={`lvl_${l.id}`}
                      dataKey={`lvl_${l.id}`}
                      yAxisId="right"
                      type="stepAfter"
                      stroke={lureColorMap[l.id]}
                      strokeDasharray="4 2"
                      {...lineProps}
                      name={`${l.name} Lvl`}
                      legendType="none"
                    />
                  ))}
              </EconomyChart>
            )}


          </ChartGrid>
        </>
      )}
    </Flex>
  );
}
