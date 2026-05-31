import { ReactNode } from "react";
import { Box, Button, Text, Tooltip } from "@radix-ui/themes";
import React from "react";

export function MyButton({
  onClick,
  disabled,
  description,
  children,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  description?: string;
}) {
  const button = (
    <Box flexGrow={"0"}>
      <Button
        radius={"none"}
        disabled={disabled}
        variant="outline"
        onClick={onClick}
      >
        <Text size={"1"}>{children}</Text>
      </Button>
    </Box>
  );

  if (!description) return button;

  return (
    <Tooltip content={description} delayDuration={0}>
      {button}
    </Tooltip>
  );
}
