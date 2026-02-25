import React from "react";
import { UpgradeT, useUpgrade } from "../stores/upgradeStore";
import { Flex, Separator, Text } from "@radix-ui/themes";
import { RT, useResource } from "../stores/resourceStore";
import { useDelivererStat, useSpeed } from "../stores/delivererStore";
import { useVector, VectorT } from "../stores/vectorStore";

function Form({
  storeFn,
  title,
  labels,
}: {
  storeFn: any;
  title: string;
  labels: string[];
}) {
  function setState(e: React.SyntheticEvent) {
    e.preventDefault();
    // @ts-ignore
    storeFn.setState((s) => {
      // @ts-ignore
      labels.forEach((type) => {
        // @ts-ignore
        if (e.target[type].value === "") {
          return;
        }

        // @ts-ignore
        const num = Number(e.target[type].value);
        if (num) s[type].amount = num;
      });
      return { ...s };
    });
  }
  return (
    <form onSubmit={setState}>
      <Flex direction={"column"} gap={"2"}>
        <Text>{title}</Text>
        <Separator size={"4"} />
        {labels.map((type) => (
          <label key={type}>
            {type}
            <input type="text" name={type} />
          </label>
        ))}
      </Flex>
      <button type="submit">Submit</button>
    </form>
  );
}

export function Debug() {
  return (
    <>
      <Flex direction={"row"} gap={"4"}>
        <Form
          storeFn={useResource}
          title={"Resources"}
          labels={Object.values(RT)}
        />
        {/*<Form*/}
        {/*  storeFn={useUpgrade}*/}
        {/*  title={"Upgrades"}*/}
        {/*  labels={[UpgradeT.Town]}*/}
        {/*/>*/}
        <Form
          storeFn={useVector}
          title={"Vector"}
          labels={Object.values(VectorT)}
        />
        <StoreView />
      </Flex>
    </>
  );
}

function StoreView() {
  const width = "250px";
  const views = {
    // Resource: useResource(),
    // Produce: useProduce(),
    // Upgrade: useUpgrade(),
    Vector: useVector(),
    // Action: useAction(),
    // Cooldown: useCooldown(),
    Deliverer: useDelivererStat(),
    // Speed: useSpeed(),
  };
  return (
    <Flex>
      {Object.entries(views).map(([text, obj]) => (
        <Flex key={text} direction={"column"} width={width}>
          <Text>{text}</Text>
          <Separator size={"4"} />
          <pre>{JSON.stringify(obj, null, 2)}</pre>
        </Flex>
      ))}
    </Flex>
  );
}
