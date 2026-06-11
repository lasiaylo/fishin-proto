import { ReactNode } from "react";
import { Box, Button, Text, Tooltip } from "@radix-ui/themes";
import React from "react";

export function MyButton({
  onClick,
  onMouseDown,
  onMouseUp,
  disabled,
  description,
  children,
}: {
  children: ReactNode;
  onClick?: () => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  disabled?: boolean;
  description?: string;
}) {
  const button = (
    <Box flexGrow={"0"}>
      <Button
        radius={"none"}
        disabled={disabled}
        variant="outline"
        onClick={onClick ?? (() => {})}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <Text size={"1"}>{children}</Text>
      </Button>
    </Box>
  );

  if (!description) return button;

  return (
    <Tooltip
      content={description}
      delayDuration={0}
      side={"right"}
      maxWidth={"200px"}
      disableHoverableContent
    >
      {button}
    </Tooltip>
  );
}
