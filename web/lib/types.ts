// Friendly names for the API schemas. `api-types.ts` is generated from the
// FastAPI OpenAPI document with `pnpm gen:api` — never edit it by hand.
import type { components } from "./api-types";

type S = components["schemas"];

export type Suspect = S["Suspect"];
export type CaseMeta = S["CaseMeta"];
export type ToolSpec = S["ToolSpec"];
export type ToolResult = S["ToolResult"];
export type Verdict = S["Verdict"];
export type EvidenceGrade = S["EvidenceGrade"];
export type ToolId = ToolResult["tool_id"];
export type LevelInfo = S["LevelInfo"];
export type RoomCreated = S["RoomCreated"];
export type Autopsy = S["Autopsy"];
export type AutopsySlide = S["AutopsySlide"];
export type Profile = S["Profile"];
