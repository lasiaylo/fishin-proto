import React from "react";
import { Box, Flex, Grid, Text } from "@radix-ui/themes";
import "../styles/noise.scss";
import { RT, useResource } from "../stores/resourceStore";
import { FuelT, useFuel } from "../stores/fuelStore";
import { useTotalRate } from "../stores/vectorStore";
import { BORDER_RADIUS } from "./styleConstants";

const RT_MIN_WIDTH = "10px";
const RATE_WIDTH = "150px";
const FILTERED_RESOURCE = new Set<string>([]);

const RTDisplay: { [key in RT]?: string } = {
  [RT.Money]: "💰",
  [RT.Production]: "🔨",
  [RT.Jimby]: "🐱",
  [RT.ExcessFood]: "🍎",
  [RT.CitySpace]: "🏠",
  [RT.Space]: "🪐",
};

export function getResourceString(rt: RT) {
  return `${getRTDisplay(rt)}`;
}

export function getRTDisplay(type: string) {
  const rt = RT[type as keyof typeof RT];
  return RTDisplay[rt] ?? "";
}

export function ResourceView({ rt }: { rt?: RT[] }) {
  const resourceList = rt ?? Object.values(RT);
  return (
    <Flex direction="column" gap="3" maxWidth={"350px"}>
      {resourceList
        .filter(
          (rt) =>
            !FILTERED_RESOURCE.has(rt) && Object.keys(RTDisplay).includes(rt),
        )
        .map((rt) => {
          return <ResourceLabel key={rt} rt={rt} />;
        })}
    </Flex>
  );
}

export function ResourceLabel({ rt }: { rt: RT }) {
  const amount = useResource((s) => s[rt].amount);
  const capacity = useResource((s) => s[rt].capacity);

  const amountLabel = Math.floor(amount);
  const p = (amount / capacity) * 100;
  return (
    <Flex direction={"row"} gap="2">
      <Box minWidth={RT_MIN_WIDTH}>
        <Text>{getResourceString(rt)}</Text>
      </Box>
      <Box
        style={{
          background: `linear-gradient(90deg, var(--gray-a4) ${p}%, white ${p}%)`,
          borderRadius: BORDER_RADIUS,
          borderColor: "var(--gray-1)",
          border: "1px solid",
        }}
        flexGrow="3"
        pl="4"
        maxHeight="24px"
      >
        <Grid columns="3" flexGrow="2">
          <Text>{amountLabel}</Text>
          <Text>{`/ ${capacity}`}</Text>
        </Grid>
      </Box>
      <RateView rt={rt} />
    </Flex>
  );
}

function FuelLabel({ type }: { type: FuelT }) {
  const { amount, baseCapacity } = useFuel((s) => s[type]);

  const p = (amount / baseCapacity) * 100;
  return (
    <Flex direction={"row"} pl="2">
      <Box minWidth={RT_MIN_WIDTH}></Box>
      <Flex align={"baseline"} width="100%" gap="1">
        <Box
          style={{
            background: `linear-gradient(90deg, var(--plum-a5) ${p}%, white ${p}%)`,
          }}
          flexGrow="1"
          height="5px"
          width="50px"
        />
      </Flex>
    </Flex>
  );
}

function RateView({ rt }: { rt: RT }) {
  const rate = useTotalRate(rt);
  const display = Math.round(rate * 100) / 100;
  let sign;
  switch (Math.sign(display)) {
    case 0:
      return <Box minWidth={RATE_WIDTH} />;
    case -1:
      sign = "-";
      break;
    case 1:
      sign = "+";
      break;
  }
  return (
    <Box minWidth={RATE_WIDTH}>
      <Text color="gray">{`${sign}${Math.abs(display)}/s`}</Text>
    </Box>
  );
}
