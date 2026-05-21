import { Box, Flex, ScrollArea, Text } from "@radix-ui/themes";
import { useEventLog } from "../stores/eventLogStore";
import React from "react";
import { usePlayer } from "../stores/playerStore";

export function EventLog() {
  const events = useEventLog((s) => s.events);
  const wallet = usePlayer((s) => s.wallet);

  return (
    <Flex
      position={"relative"}
      mt="4"
      direction="column"
      flexShrink="0"
      maxHeight="500px"
      width="200px"
      gap={"5"}
    >
      <Text size="2">Money: ${wallet}</Text>
      <Flex overflow="hidden">
        <Flex pr="4" direction="column" gap="3">
          {events.map((event, i) => (
            <Text key={event.id} size="1" className={i === 0 ? "fade-in" : undefined} color="gray">
              {event.msg}
            </Text>
          ))}
        </Flex>
        <Box
          className={"wahoo"}
          position={"absolute"}
          bottom={"0"}
          width={"100%"}
          height={"60%"}
          style={{
            background:
              "linear-gradient(to bottom, transparent, var(--color-background))",
            // "red",
          }}
        />
      </Flex>
    </Flex>
  );
}
