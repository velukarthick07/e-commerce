/** Shapes shared between the setup API and the wizard in the browser. */

export type CheckStatus = "pass" | "warn" | "fail";

export interface CheckResult {
  id: string;
  label: string;
  requirement: string;
  status: CheckStatus;
  detail: string;
  hint?: string;
}

export interface CheckGroup {
  title: string;
  description: string;
  checks: CheckResult[];
}

export interface RequirementReport {
  groups: CheckGroup[];
  ok: boolean;
  passed: number;
  warnings: number;
  failures: number;
  checkedAt: string;
}

export type TargetState = "missing" | "empty" | "has-schema" | "installed" | "foreign";

export interface ServerReport {
  serverVersion: string;
  serverMajor: number;
  versionSupported: boolean;
  currentUser: string;
  canCreateDatabase: boolean;
  isSuperuser: boolean;
  target: TargetState;
  tableCount: number;
  userCount: number;
  canProceed: boolean;
  message: string;
}

export type StepId =
  | "connect"
  | "database"
  | "schema"
  | "defaults"
  | "administrator"
  | "configure";

export type StepStatus = "pending" | "running" | "done" | "failed";

/** One line of the newline-delimited JSON stream the installer writes. */
export type InstallEvent =
  | { kind: "step"; id: StepId; label?: string; status: "running" | "done" | "failed"; detail?: string }
  | { kind: "log"; line: string }
  | { kind: "done"; adminEmail: string; database: string }
  | { kind: "error"; stepId?: StepId; message: string };

export interface SetupStatus {
  /** False once setup has run — the wizard refuses to reappear. */
  required: boolean;
  /** Whether a setup key must be supplied to install. */
  keyRequired: boolean;
  completedAt?: string;
}

export interface DatabaseFormValues {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}
