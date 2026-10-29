// The asset screen works with the generated API types directly.
// Decimal columns (replacementCost, estimatedCost, cost) can arrive as strings
// like "45.00" despite the `number` type — always read them through Number().
export type { Asset, MaintenanceTask, ServiceRecord } from "@workspace/api-client-react";
