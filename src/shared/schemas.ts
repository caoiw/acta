import { z } from "zod";

const IdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
const ShortTextSchema = z.string().max(500);
const SafeFileNameSchema = z
  .string()
  .min(1)
  .max(120)
  .refine(
    (value) =>
      !value.includes("/") &&
      !value.includes("\\") &&
      ![".", ".."].includes(value),
    {
      message: "Nome de arquivo inválido.",
    },
  );

export const LocatorSchema = z
  .object({
    strategy: z.enum(["role", "label", "text", "placeholder", "testId", "css"]),
    value: z.string().min(1).max(500),
    role: z.string().min(1).max(60).optional(),
    exact: z.boolean().optional(),
  })
  .strict();

export const ValueBindingSchema = z
  .object({
    kind: z.enum(["column", "fixed", "prompt", "secret"]),
    value: z.string().max(10_000),
    sensitive: z.boolean().optional(),
  })
  .strict();

const StepBase = {
  id: IdSchema,
  label: z.string().min(1).max(240),
  description: z.string().max(1_000).optional(),
  enabled: z.boolean(),
  risk: z.enum(["low", "medium", "high", "critical"]),
  timeoutMs: z.number().int().positive().max(120_000).optional(),
  continueOnError: z.boolean().optional(),
};

export const AtomicStepSchema = z.discriminatedUnion("type", [
  z
    .object({ ...StepBase, type: z.literal("open"), url: ValueBindingSchema })
    .strict(),
  z
    .object({ ...StepBase, type: z.literal("click"), target: LocatorSchema })
    .strict(),
  z
    .object({ ...StepBase, type: z.literal("check"), target: LocatorSchema })
    .strict(),
  z
    .object({
      ...StepBase,
      type: z.literal("fill"),
      target: LocatorSchema,
      value: ValueBindingSchema,
    })
    .strict(),
  z
    .object({
      ...StepBase,
      type: z.literal("select"),
      target: LocatorSchema,
      value: ValueBindingSchema,
    })
    .strict(),
  z
    .object({ ...StepBase, type: z.literal("verify"), target: LocatorSchema })
    .strict(),
  z
    .object({
      ...StepBase,
      type: z.literal("wait"),
      durationMs: z.number().int().min(100).max(120_000),
    })
    .strict(),
  z
    .object({
      ...StepBase,
      type: z.literal("checkpoint"),
      message: z.string().min(1).max(1_000),
    })
    .strict(),
  z
    .object({
      ...StepBase,
      type: z.literal("screenshot"),
      fileName: SafeFileNameSchema.optional(),
    })
    .strict(),
]);

export const ConditionStepSchema = z
  .object({
    ...StepBase,
    type: z.literal("condition"),
    condition: z
      .object({
        column: z.string().min(1).max(200),
        operator: z.enum([
          "equals",
          "not_equals",
          "contains",
          "empty",
          "not_empty",
        ]),
        value: ShortTextSchema.optional(),
      })
      .strict(),
    thenSteps: z.array(AtomicStepSchema).max(100),
    elseSteps: z.array(AtomicStepSchema).max(100).optional(),
  })
  .strict();

export const RoutineStepSchema = z.union([
  AtomicStepSchema,
  ConditionStepSchema,
]);

export const DataSetSchema = z
  .object({
    id: IdSchema,
    fileName: z.string().min(1).max(260),
    sheetName: z.string().min(1).max(200),
    columns: z.array(z.string().min(1).max(200)).min(1).max(200),
    rows: z
      .array(
        z.record(
          z.string().max(200),
          z.union([z.string().max(10_000), z.number(), z.boolean(), z.null()]),
        ),
      )
      .max(50_000),
    importedAt: z.string().max(60),
    issues: z.array(z.string().max(500)).max(100),
  })
  .strict();

export const RoutineSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).max(160),
    description: z.string().max(2_000),
    area: z.enum(["rh", "financeiro", "compras", "operacoes", "outra"]),
    status: z.enum(["draft", "ready", "needs_review"]),
    version: z.number().int().positive(),
    createdAt: z.string().max(60),
    updatedAt: z.string().max(60),
    lastTestedAt: z.string().max(60).optional(),
    domains: z
      .array(
        z
          .string()
          .min(1)
          .max(253)
          .regex(/^[a-z0-9.-]+$/i),
      )
      .min(1)
      .max(20),
    steps: z.array(RoutineStepSchema).max(500),
    dataSet: DataSetSchema.optional(),
    sensitiveColumns: z.array(z.string().max(200)).max(200),
    browserChannel: z.enum(["msedge", "chrome"]),
    runHeaded: z.literal(true),
    isExample: z.boolean().optional(),
  })
  .strict();

export const StartRunInputSchema = z
  .object({
    routine: RoutineSchema,
    mode: z.enum(["test", "all", "retry"]),
    rowIndices: z.array(z.number().int().nonnegative()).max(50_000).optional(),
  })
  .strict();

export const StartRunRequestSchema = z
  .object({
    routineId: IdSchema,
    routineVersion: z.number().int().positive(),
    mode: z.enum(["test", "all", "retry"]),
    rowIndices: z.array(z.number().int().nonnegative()).max(50_000).optional(),
  })
  .strict();

export const RecorderPayloadSchema = z
  .object({
    kind: z.enum(["click", "fill", "select", "check"]),
    target: LocatorSchema,
    value: z.string().max(10_000).optional(),
    sensitive: z.boolean().optional(),
  })
  .strict();

export const RecorderStartSchema = z
  .object({
    url: z.string().url().max(2_048),
    domains: z
      .array(
        z
          .string()
          .min(1)
          .max(253)
          .regex(/^[a-z0-9.-]+$/i),
      )
      .min(1)
      .max(20),
    browserChannel: z.enum(["msedge", "chrome"]),
  })
  .strict();
