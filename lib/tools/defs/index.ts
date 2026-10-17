import { accountTools } from "./account";
import { askTools } from "./ask";
import { assetTools } from "./assets";
import { timelineEditTools } from "./edit";
import { editorTools } from "./editor";
import { jobTools } from "./jobs";
import { libraryTools } from "./library";
import { makeTools } from "./make";
import { navigateTools } from "./navigate";
import { planTools } from "./plan";

/** Every tool, including legacy ones. Order is the catalog order. */
export const TOOL_DEFS = [
  ...makeTools,
  ...planTools,
  ...assetTools,
  ...libraryTools,
  ...jobTools,
  ...editorTools,
  ...timelineEditTools,
  ...accountTools,
  ...navigateTools,
  ...askTools,
];
