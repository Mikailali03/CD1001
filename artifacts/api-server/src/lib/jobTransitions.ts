// The CasaService job lifecycle. Every status change goes through here so the
// rules live in one place:
//
//   open ──accept──▶ claimed ──en_route──▶ en_route ──arrive──▶ arrived
//    │                 │  ▲                                        │
//    │                 │  └──release (technician) ── back to open  │
//    └──cancel─────────┴──cancel (homeowner) ──▶ cancelled         │
//                      claimed / en_route / arrived ──complete──▶ completed
//
// Once a technician is on the way the homeowner can't cancel in the app; they
// call the technician or us. Completed and cancelled jobs are final.

export type JobStatus = "open" | "claimed" | "en_route" | "arrived" | "completed" | "cancelled";

export type JobAction = "accept" | "schedule" | "en_route" | "arrive" | "complete" | "cancel" | "release";

const ALLOWED_FROM: Record<JobAction, readonly JobStatus[]> = {
  accept: ["open"],
  // Rescheduling is fine until the technician sets off.
  schedule: ["claimed"],
  en_route: ["claimed"],
  arrive: ["en_route"],
  complete: ["claimed", "en_route", "arrived"],
  cancel: ["open", "claimed"],
  release: ["claimed"],
};

const RESULT: Partial<Record<JobAction, JobStatus>> = {
  accept: "claimed",
  en_route: "en_route",
  arrive: "arrived",
  complete: "completed",
  cancel: "cancelled",
  release: "open",
};

export function canTransition(from: string, action: JobAction): boolean {
  return (ALLOWED_FROM[action] as readonly string[]).includes(from);
}

/** The status after `action`, or the same status for actions that don't change it. */
export function nextStatus(from: JobStatus, action: JobAction): JobStatus {
  return RESULT[action] ?? from;
}

/** Statuses an action is allowed from, for conditional UPDATEs that guard against races. */
export function allowedFrom(action: JobAction): JobStatus[] {
  return [...ALLOWED_FROM[action]];
}

export const ACTIVE_JOB_STATUSES: JobStatus[] = ["open", "claimed", "en_route", "arrived"];
