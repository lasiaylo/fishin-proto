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

export function EconomyChart({
  title,
  data,
  maxTime = 0,
  xTicks,
  integerXAxis,
  integerYAxis,
  yDomain,
  yTickFormatter,
  tooltipFormatter,
  tooltipLabelFormatter,
  header,
  children,
  xDataKey = "time",
  xDomain,
  xTickFormatter,
  xLabel,
  syncId = "economy",
  height = 200,
}: {
  title: string;
  data: object[];
  maxTime?: number;
  xTicks?: number[];
  integerXAxis?: boolean;
  integerYAxis?: boolean;
  yDomain?: [number | string, number | string];
  yTickFormatter?: (v: number) => string;
  tooltipFormatter?: (v: number, name: string, props: any) => any;
  tooltipLabelFormatter?: (v: number, payload?: any[]) => React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  xDataKey?: string;
  xDomain?: [number, number];
  xTickFormatter?: (v: number) => string;
  xLabel?: string;
  syncId?: string;
  height?: number;
}) {
  return (
    <Flex direction="column" gap="2">
      <Flex align="center" gap="4" wrap="wrap">
        <Text size="2" weight="bold">
          {title}
        </Text>
        {header}
      </Flex>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} syncId={syncId}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey={xDataKey}
            type="number"
            domain={xDomain ?? [0, maxTime]}
            ticks={xTicks}
            allowDecimals={!integerXAxis}
            tickFormatter={xTickFormatter ?? ((v: number) => `${v / 60}`)}
            label={
              xLabel
                ? {
                    value: xLabel,
                    position: "insideBottomRight",
                    offset: -4,
                    fontSize: 11,
                  }
                : undefined
            }
          />
          <YAxis
            allowDecimals={!integerYAxis}
            domain={yDomain}
            tickFormatter={yTickFormatter}
          />
          <Tooltip
            labelStyle={{ color: "#111" }}
            // @ts-ignore
            formatter={tooltipFormatter ?? ((v: number) => +v.toFixed(2))}
            // @ts-ignore
            labelFormatter={
              tooltipLabelFormatter ??
              ((label: number) => +Number(label).toFixed(2))
            }
          />
          {children}
        </ComposedChart>
      </ResponsiveContainer>
    </Flex>
  );
}
