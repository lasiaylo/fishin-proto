import React from "react";
import { Button, Flex } from "@radix-ui/themes";
import { setIsVenture } from "../stores/ventureStore";

export function YardView() {
  return (
    <Flex justify={"center"}>
      <Button
        color="green"
        variant={"surface"}
        onClick={() => setIsVenture(true)}
      >
        Venture
      </Button>
    </Flex>
  );
}
