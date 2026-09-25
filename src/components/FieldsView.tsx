import React from "react";
import { Flex } from "@radix-ui/themes";
import { CooldownButton } from "./CooldownButton";
import { useFields, wind } from "../stores/fieldsStore";
import { FIELDS_WIND_COOLDOWN_MS } from "../util/constants";

export function FieldsView() {
  const readyAt = useFields((s) => s.readyAt);

  return (
    <Flex direction="column" gap="2" minHeight={"150px"}>
      <CooldownButton
        readyAt={readyAt}
        cooldownMs={FIELDS_WIND_COOLDOWN_MS}
        onFire={wind}
        width={100}
      >
        wind
      </CooldownButton>
    </Flex>
  );
}
