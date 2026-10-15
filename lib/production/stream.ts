import type { PlanningProgress } from "./progress";
import type { ProductionStatus } from "./schema";

export type ProductionStreamEvent =
  | ({ type: "created"; id: string } & PlanningProgress)
  | ({ type: "progress" } & PlanningProgress)
  | { type: "done"; id: string; status: ProductionStatus }
  | { type: "error"; error: string; id?: string };
