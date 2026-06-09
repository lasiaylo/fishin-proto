import React from "react";
import { Flex, Text } from "@radix-ui/themes";
import {
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const lineProps = {
  dot: false as const,
  strokeWidth: 2,
  isAnimationActive: false,
};

// @ts-ignore
export function EconomyChart({
  title,
  data,
  maxTime,
  xTicks,
  integerYAxis,
  header,
  children,
  xDataKey = "time",
  xDomain,
  xTickFormatter,
  syncId = "economy",
}: {
  title: string;
  data: object[];
  maxTime: number;
  xTicks?: number[];
  integerYAxis?: boolean;
  header?: React.ReactNode;
  children: React.ReactNode;
  xDataKey?: string;
  xDomain?: [number, number];
  xTickFormatter?: (v: number) => string;
  syncId?: string;
}) {
  return (
    <Flex direction="column" gap="2">
      <Flex align="center" gap="4" wrap="wrap">
        <Text size="2" weight="bold">
          {title}
        </Text>
        {header}
      </Flex>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} syncId={syncId}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey={xDataKey}
            type="number"
            domain={xDomain ?? [0, maxTime]}
            ticks={xTicks}
            tickFormatter={xTickFormatter ?? ((v: number) => `${v / 60}`)}
          />
          <YAxis allowDecimals={!integerYAxis} />
          <Tooltip
            labelStyle={{ color: "#111" }}
            // @ts-ignore
            formatter={(v: number) => +v.toFixed(2)}
            // @ts-ignore
            labelFormatter={(label: number) => +Number(label).toFixed(2)}
          />
          {children}
        </ComposedChart>
      </ResponsiveContainer>
    </Flex>
  );
}
