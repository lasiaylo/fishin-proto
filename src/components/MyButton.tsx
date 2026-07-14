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
  minWidth,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  disabled?: boolean;
  description?: string;
  minWidth?: number;
  style?: React.CSSProperties;
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
        style={{ height: "auto", ...style }}
      >
        <Box minWidth={`${minWidth ?? 0}px`} py={"2"}>
          <Text size={"1"}>{children}</Text>
        </Box>
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
