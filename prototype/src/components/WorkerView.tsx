import React from "react";
import { UpgradeT } from "../stores/upgradeStore";
import { BuyableView } from "./UpgradeView";
import { MenuSection } from "./menuSection";

export const WORKER_BUYABLES = [UpgradeT.Deliverer, UpgradeT.Baker];

export function WorkerView() {
  return <BuyableView buyables={WORKER_BUYABLES} />;
}

//
// function WorkerRow({type}: { type: WorkerT }) {
//   const allocated = useAllocated(type)
//   const add = useCallback(() => addWorker(type, 1), [type])
//   const minus = useCallback(() => addWorker(type, -1), [type])
//   return (
//     <>
//       <Text style={{justifySelf: "flex-start"}}>{`${type}:`}</Text>
//       <Text>{allocated}</Text>
//       <Flex gap={"1"}>
//         <AllocateButton onClick={minus}>-</AllocateButton>
//         <AllocateButton onClick={add}>+</AllocateButton>
//       </Flex>
//     </>
//   )
// }
//
// function AllocateButton({children, onClick}: { children: string, onClick: () => void }) {
//   return (<Button
//       onClick={onClick}
//       radius="full"
//       size="1"
//       variant={"surface"}
//     >
//       {children}
//     </Button>
//   )
// }
