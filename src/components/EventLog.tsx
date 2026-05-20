import { Flex, ScrollArea, Text } from "@radix-ui/themes";
import { useEventLog } from "../stores/eventLogStore";
import React from "react";
import {usePlayer} from "../stores/playerStore";

export function EventLog() {
  const events = useEventLog((s) => s.events);
  const wallet = usePlayer((s) => s.wallet);

  return (
    <Flex mt="4" direction="column" flexShrink="0" width="200px" gap={"8"}>
        <Text size="2" >
            Money: ${wallet}
        </Text>
        <ScrollArea style={{ height: "calc(100vh - 100px)" }}>
        <Flex pr="4" direction="column" gap="1">
          {events.map((event, i) => (
            <Text key={i} size="1" className="fade-in" color="gray">
              {event}
            </Text>
          ))}
        </Flex>
      </ScrollArea>
    </Flex>
  );
}
