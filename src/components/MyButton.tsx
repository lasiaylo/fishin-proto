import { ReactNode } from "react";
import { Box, Button, Text } from "@radix-ui/themes";
import React from "react";

export function MyButton({
  onClick,
  disabled,
  children,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
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
}
