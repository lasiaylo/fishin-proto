import React, { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Flex } from "@radix-ui/themes";

interface HoverPopoverProps {
  triggerContent: React.ReactElement;
  popoverContent?: React.ReactElement;
}

const HoverPopover = ({
  triggerContent,
  popoverContent,
}: HoverPopoverProps) => {
  const [open, setOpen] = useState(false);

  const handleMouseEnter = () => {
    setOpen(true);
  };

  const handleMouseLeave = () => {
    setOpen(false);
  };

  return (
    <Flex>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          asChild={true}
          onMouseOver={handleMouseEnter}
          onMouseOut={handleMouseLeave}
          onClick={(e) => {
            e.preventDefault();
          }}
        >
          {triggerContent}
        </Popover.Trigger>
        <Popover.Anchor />
        {popoverContent && (
          <Popover.Content
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            avoidCollisions={false}
            align={"start"}
            side="right"
            sideOffset={10}
          >
            {popoverContent}
          </Popover.Content>
        )}
      </Popover.Root>
    </Flex>
  );
};

export default HoverPopover;
