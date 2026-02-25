import { Flex, Separator, Text } from "@radix-ui/themes";
import React from "react";

export function MenuSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Flex gap="3" direction="column">
      <Text>{title}</Text>
      <Separator size={"4"} />
      {children}
    </Flex>
  );
}
