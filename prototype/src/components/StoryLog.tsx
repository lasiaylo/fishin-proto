import React from "react";
import { Flex, ScrollArea } from "@radix-ui/themes";

import { StoryLogData } from "../Story";

export function StoryLog() {
  const stories = StoryLogData.map((story, i) => (
    <Flex key={i} className={"fade-in no-select"}>
      {story}
    </Flex>
  )).toReversed();
  return (
    <Flex flexShrink="1" maxWidth="300px">
      <ScrollArea style={{ height: 250 }}>
        <Flex pr="4" direction="column" gap="2">
          {stories}
        </Flex>
      </ScrollArea>
    </Flex>
  );
}

/*"
Story
  ID
  Description
  Callback
 */
