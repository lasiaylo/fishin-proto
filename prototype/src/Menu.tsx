import { Badge, Container, Flex, Tabs, Text } from "@radix-ui/themes";
import React from "react";
import { ProduceView } from "./components/produceView";
import { HomeView } from "./components/homeView";
import { create } from "zustand";
import { Unlockable } from "./components/unlocks";
import _ from "lodash";
import { useFocusedProduce } from "./stores/produceStore";
import { DotFilledIcon, FaceIcon } from "@radix-ui/react-icons";
import { YardView } from "./components/yardView";

export function Menu() {
  const tabs = useMenuUnlock((s) => s);
  const focus = useFocusedProduce((s) => s.focus);
  const filteredTabs: MenuState = _.pickBy(
    tabs,
    (tab: TabView) => tab.unlocked,
  );

  const getTab = (tab: string) => {
    if (tab !== "A Fire") return tab;
    if (focus !== undefined) return tab;
    return (
      <Flex gap="1">
        <DotFilledIcon
          color={"orange"}
          style={{
            position: "absolute",
            top: "-3px",
            right: "-5px",
          }}
        />
        <Text>{tab}</Text>
      </Flex>
    );
  };
  return (
    <Tabs.Root defaultValue={Object.keys(filteredTabs)[0]}>
      <Tabs.List color="orange" justify={"center"}>
        {Object.keys(filteredTabs).map((tab) => (
          <Tabs.Trigger key={tab} value={tab} style={{ position: "relative" }}>
            {getTab(tab)}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {Object.entries(filteredTabs).map(([tab, { component }]) => {
        const Component = component;
        return (
          <Tabs.Content key={tab} value={tab} className={"fade-in"}>
            <Container size="1" m={"4"} width={"50%"}>
              <Component />
            </Container>
          </Tabs.Content>
        );
      })}
    </Tabs.Root>
  );
}

export enum MenuT {
  Fire = "A Fire",
  Bakery = "A Bakery",
  FrontYard = "A Front Yard",
}

interface TabView extends Unlockable {
  component: () => React.ReactNode;
}

type MenuState = { [key in MenuT]: TabView };
export const useMenuUnlock = create<MenuState>(() => ({
  [MenuT.Fire]: getRoom(ProduceView, true),
  [MenuT.Bakery]: getRoom(HomeView),
  [MenuT.FrontYard]: getRoom(YardView),
}));

function getRoom(component: () => React.ReactNode, unlocked: boolean = false) {
  return { component: component, unlocked: unlocked };
}
