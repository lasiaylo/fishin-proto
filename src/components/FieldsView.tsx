import React from "react";
import { Flex } from "@radix-ui/themes";
import { CooldownButton } from "./CooldownButton";
import { useFields, wind } from "../stores/fieldsStore";

export function FieldsView() {
  const readyAt = useFields((s) => s.readyAt);
  const cooldownMs = useFields((s) => s.cooldownMs);

  return (
    <Flex direction="column" justify="end" gap="2" py="3" minHeight={"150px"}>
      <CooldownButton
        readyAt={readyAt}
        cooldownMs={cooldownMs}
        onFire={wind}
        width={100}
      >
        wind
      </CooldownButton>
    </Flex>
  );
}
