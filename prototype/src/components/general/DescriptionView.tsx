import { DetailedCosts } from "../../util/Costs";
import { Box, DataList, Flex, Separator, Text } from "@radix-ui/themes";
import React from "react";

export function DescriptionView({
  flavor,
  effect,
  costs,
}: {
  flavor: string;
  effect?: string;
  costs?: DetailedCosts;
}) {
  return (
    <Flex
      px="2"
      py={"1"}
      className={"description"}
      direction={"column"}
      gap={"1"}
      maxWidth="200px"
    >
      <Box>
        <Text size="1">{flavor}</Text>
      </Box>
      {costs && <CostTable costs={costs} />}
      {effect && (
        <>
          <Separator size="4" />
          <Text size="1" weight={"light"}>
            {effect}
          </Text>
        </>
      )}
    </Flex>
  );
}

function CostTable({ costs }: { costs: DetailedCosts }) {
  return (
    <DataList.Root size={"1"} className={"description-table"}>
      {Object.entries(costs).map(([rt, { calculatedCost, atCost }]) => {
        if (calculatedCost === 0) return;
        const style = atCost ? undefined : { color: "var(--red-a9)" };
        return (
          <DataList.Item key={rt}>
            <DataList.Label style={style}>{rt}</DataList.Label>
            <DataList.Value>
              <Text style={style}>{calculatedCost}</Text>
            </DataList.Value>
          </DataList.Item>
        );
      })}
    </DataList.Root>
  );
}
