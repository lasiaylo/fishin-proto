import React, { useEffect, useState } from "react";
import { Container, Section } from "@radix-ui/themes";
import { useField } from "../stores/FieldStore";
import { RT, useResource } from "../stores/resourceStore";
import { getRandom } from "../util/util";

const MAX_BLOOM_TIME = 1700;
const MIN_BLOOM_TIME = 700;
const BLANK = "…";
const BUD = "𖥧";
const FLOWER = "⚘";
export const DISPLAY_MULT = 1;

export function FieldView() {
  const field = useField((s) => s.display);
  const limit = useResource((s) => s[RT.FieldFlower].capacity);

  const str = Array(limit * DISPLAY_MULT)
    .fill(null)
    .map((prev, i) =>
      field.has(i) ? (
        <Flower key={i} />
      ) : (
        <span className={"monospace"}>{BLANK}</span>
      ),
    );
  return (
    <Section className={"field"} size={"3"} pt={"10%"}>
      <Container size={"1"} maxWidth={"70%"}>
        {str}
      </Container>
    </Section>
  );
}

function Flower() {
  const [isBud, setBud] = useState<boolean>(true);
  useEffect(() => {
    const bloom_time = getRandom(MIN_BLOOM_TIME, MAX_BLOOM_TIME);
    setTimeout(() => {
      setBud(false);
    }, bloom_time);
  }, []);
  return isBud ? (
    <span className={"monospace fade-in bud"}>{BUD}</span>
  ) : (
    <span className={"monospace fade-in"}>{FLOWER}</span>
  );
}
