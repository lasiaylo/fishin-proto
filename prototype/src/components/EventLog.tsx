import { Flex, Heading, ScrollArea, Text } from "@radix-ui/themes";
import { useEventLog } from "../stores/eventLogStore";
import React from "react";

export function EventLog() {
  const events = useEventLog((s) => s.events);

  return (
    <Flex direction="column" flexShrink="0" width="200px">
      <Heading size="3" mb="3">
        Event Log
      </Heading>
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
