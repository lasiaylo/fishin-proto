import { Flex, ScrollArea, Text } from "@radix-ui/themes";
import { useEventLog } from "../stores/eventLogStore";
import React from "react";

export function EventLog() {
  const events = useEventLog((s) => s.events);

  return (
    <Flex mt="9" direction="column" flexShrink="0" width="200px">
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
