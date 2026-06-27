import { Box, Flex, Text } from "@radix-ui/themes";
import { useEventLog } from "../stores/eventLogStore";
import React from "react";

export function EventView() {
  const events = useEventLog((s) => s.events);

  return (
    <Flex
      position={"relative"}
      mt="6"
      direction="column"
      flexShrink="0"
      maxHeight="300px"
      width="200px"
      gap={"5"}
    >
      <Flex overflow="hidden" direction="column" gap="3">
        {events.map((event, i) => (
          <Text
            key={event.id}
            size="1"
            className={i === 0 ? "fade-in" : undefined}
            color="gray"
          >
            {event.msg}
            {event.colored && (
              <Text as="span" size="1" color={event.color as "gray"}>
                {event.colored}
              </Text>
            )}
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
  );
}
