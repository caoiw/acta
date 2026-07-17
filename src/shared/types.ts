export type RoutineStatus = "draft" | "ready" | "needs_review";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type RunStatus =
  | "preparing"
  | "running"
  | "pausing"
  | "paused"
  | "waiting"
  | "completed"
  | "completed_with_errors"
  | "cancelled"
  | "failed";

export type RunItemStatus =
  | "pending"
  | "running"
  | "success"
  | "skipped"
  | "error"
  | "needs_review"
  | "cancelled";

export type StepType =
  | "open"
  | "click"
  | "fill"
  | "select"
  | "check"
  | "verify"
  | "wait"
  | "checkpoint"
  | "screenshot"
  | "condition";

export type LocatorStrategy =
  "role" | "label" | "text" | "placeholder" | "testId" | "css";

export interface Locator {
  strategy: LocatorStrategy;
  value: string;
  role?: string;
  exact?: boolean;
}

export interface ValueBinding {
  kind: "column" | "fixed" | "prompt" | "secret";
  value: string;
  sensitive?: boolean;
}

export interface StepBase {
  id: string;
  type: StepType;
  label: string;
  description?: string;
  enabled: boolean;
  risk: RiskLevel;
  timeoutMs?: number;
  continueOnError?: boolean;
}

export interface OpenStep extends StepBase {
  type: "open";
  url: ValueBinding;
}

export interface TargetStep extends StepBase {
  type: "click" | "check";
  target: Locator;
}

export interface ValueStep extends StepBase {
  type: "fill" | "select";
  target: Locator;
  value: ValueBinding;
}

export interface VerifyStep extends StepBase {
  type: "verify";
  target: Locator;
}

export interface WaitStep extends StepBase {
  type: "wait";
  durationMs: number;
}

export interface CheckpointStep extends StepBase {
  type: "checkpoint";
  message: string;
}

export interface ScreenshotStep extends StepBase {
  type: "screenshot";
  fileName?: string;
}

export type AtomicStep =
  | OpenStep
  | TargetStep
  | ValueStep
  | VerifyStep
  | WaitStep
  | CheckpointStep
  | ScreenshotStep;

export interface ConditionStep extends StepBase {
  type: "condition";
  condition: {
    column: string;
    operator: "equals" | "not_equals" | "contains" | "empty" | "not_empty";
    value?: string;
  };
  thenSteps: AtomicStep[];
  elseSteps?: AtomicStep[];
}

export type RoutineStep = AtomicStep | ConditionStep;

export interface DataSet {
  id: string;
  fileName: string;
  sheetName: string;
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  importedAt: string;
  issues: string[];
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  area: "rh" | "financeiro" | "compras" | "operacoes" | "outra";
  status: RoutineStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastTestedAt?: string;
  domains: string[];
  steps: RoutineStep[];
  dataSet?: DataSet;
  sensitiveColumns: string[];
  browserChannel: "msedge" | "chrome";
  runHeaded: true;
  isExample?: boolean;
}

export interface StepRecord {
  stepId: string;
  label: string;
  status: "success" | "error" | "skipped";
  startedAt: string;
  endedAt: string;
  message?: string;
}

export interface RunItem {
  index: number;
  key: string;
  label: string;
  status: RunItemStatus;
  startedAt?: string;
  endedAt?: string;
  currentStepId?: string;
  stepRecords: StepRecord[];
  inputSnapshot?: Record<string, string | number | boolean | null>;
  error?: {
    kind:
      | "not_found"
      | "multiple_matches"
      | "session_expired"
      | "invalid_data"
      | "verification_failed"
      | "domain_blocked"
      | "browser_unavailable"
      | "unknown";
    title: string;
    message: string;
    stepId?: string;
    screenshotPath?: string;
  };
}

export interface RunSummary {
  total: number;
  processed: number;
  success: number;
  skipped: number;
  errors: number;
  needsReview: number;
}

export interface Run {
  id: string;
  routineId: string;
  routineName: string;
  routineVersion: number;
  mode: "test" | "all" | "retry";
  status: RunStatus;
  startedAt: string;
  endedAt?: string;
  domains: string[];
  dataFileName: string;
  items: RunItem[];
  summary: RunSummary;
}

export interface RecorderAction {
  id: string;
  kind: "open" | "click" | "fill" | "select" | "check";
  url?: string;
  target?: Locator;
  value?: string;
  sensitive?: boolean;
  label: string;
  timestamp: string;
}

export type RunEvent =
  | { type: "run-started"; run: Run }
  | { type: "item-started"; runId: string; itemIndex: number }
  | { type: "step-started"; runId: string; itemIndex: number; stepId: string }
  | {
      type: "step-completed";
      runId: string;
      itemIndex: number;
      stepId: string;
      record: StepRecord;
    }
  | { type: "item-completed"; runId: string; item: RunItem }
  | { type: "run-paused"; runId: string }
  | { type: "run-resumed"; runId: string }
  | {
      type: "checkpoint";
      runId: string;
      itemIndex: number;
      stepId: string;
      message: string;
    }
  | { type: "run-completed"; run: Run };

export interface StartRunInput {
  routine: Routine;
  mode: "test" | "all" | "retry";
  rowIndices?: number[];
}

export interface StartRunRequest {
  routineId: string;
  routineVersion: number;
  mode: "test" | "all" | "retry";
  rowIndices?: number[];
}

export interface BootstrapInfo {
  demoUrl: string;
  platform: string;
  browserLabel: string;
  appVersion: string;
}

export interface VaultEntry {
  name: string;
  updatedAt: string;
}

export interface ActaAPI {
  bootstrap(): Promise<BootstrapInfo>;
  routines: {
    list(): Promise<Routine[]>;
    get(id: string): Promise<Routine | null>;
    save(routine: Routine): Promise<Routine>;
    remove(id: string): Promise<void>;
    importFile(): Promise<Routine | null>;
    exportFile(routine: Routine): Promise<string | null>;
  };
  runs: {
    list(): Promise<Run[]>;
    get(id: string): Promise<Run | null>;
    exportCsv(runId: string): Promise<string | null>;
    readArtifact(runId: string, itemIndex: number): Promise<string | null>;
  };
  data: {
    pickSpreadsheet(): Promise<DataSet | null>;
  };
  recorder: {
    start(input: {
      url: string;
      domains: string[];
      browserChannel: "msedge" | "chrome";
    }): Promise<void>;
    stop(): Promise<RecorderAction[]>;
    onAction(callback: (action: RecorderAction) => void): () => void;
  };
  runner: {
    start(input: StartRunRequest): Promise<{ runId: string }>;
    pause(runId: string): Promise<void>;
    resume(runId: string): Promise<void>;
    cancel(runId: string): Promise<void>;
    continueCheckpoint(runId: string): Promise<void>;
    onEvent(callback: (event: RunEvent) => void): () => void;
  };
  vault: {
    list(): Promise<VaultEntry[]>;
    set(name: string, value: string): Promise<void>;
    remove(name: string): Promise<void>;
  };
}

declare global {
  interface Window {
    acta?: ActaAPI;
  }
}
