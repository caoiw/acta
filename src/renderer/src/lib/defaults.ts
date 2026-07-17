import type { AtomicStep, DataSet, Routine, RoutineStep } from "@shared/types";

const names = [
  "Ana Martins",
  "Bruno Souza",
  "Carla Lima",
  "Diego Rocha",
  "Elisa Nunes",
  "Felipe Costa",
  "Gabriela Alves",
  "Henrique Melo",
  "Isabela Ramos",
  "João Teixeira",
  "Karen Duarte",
  "Lucas Freitas",
  "Mariana Prado",
  "Nicolas Ribeiro",
  "Olívia Campos",
  "Paulo Azevedo",
  "Renata Castro",
  "Samuel Moraes",
  "Talita Vieira",
  "Vitor Gomes",
];

export function createDemoDataSet(): DataSet {
  return {
    id: crypto.randomUUID(),
    fileName: "colaboradores-exemplo.xlsx",
    sheetName: "Colaboradores",
    columns: ["Nome", "E-mail", "Cargo", "Departamento"],
    rows: names.map((name, index) => ({
      Nome: name,
      "E-mail": `${name
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, ".")}@empresa.com`,
      Cargo:
        index % 3 === 0 ? "Motorista" : index % 3 === 1 ? "Gestor" : "Analista",
      Departamento: index % 2 ? "Operações" : "Administrativo",
    })),
    importedAt: new Date().toISOString(),
    issues: [],
  };
}

type AtomicDraft<T extends AtomicStep = AtomicStep> = T extends AtomicStep
  ? Omit<T, "id" | "enabled" | "risk"> & Partial<Pick<T, "risk">>
  : never;

function atomic(step: AtomicDraft): AtomicStep {
  return {
    ...step,
    id: crypto.randomUUID(),
    enabled: true,
    risk: step.risk ?? "low",
  } as AtomicStep;
}

export function createExampleRoutine(
  demoUrl: string,
  name = "Cadastro de colaboradores",
): Routine {
  const now = new Date().toISOString();
  const steps: RoutineStep[] = [
    atomic({
      type: "open",
      label: "Abra a página de colaboradores",
      url: { kind: "fixed", value: demoUrl },
    }),
    atomic({
      type: "click",
      label: "Clique no botão “Novo colaborador”",
      target: {
        strategy: "role",
        role: "button",
        value: "Novo colaborador",
        exact: true,
      },
    }),
    atomic({
      type: "fill",
      label: "Preencha “Nome” com a coluna Nome",
      target: { strategy: "label", value: "Nome", exact: true },
      value: { kind: "column", value: "Nome" },
      risk: "medium",
    }),
    atomic({
      type: "fill",
      label: "Preencha “E-mail” com a coluna E-mail",
      target: { strategy: "label", value: "E-mail", exact: true },
      value: { kind: "column", value: "E-mail", sensitive: true },
      risk: "medium",
    }),
    atomic({
      type: "select",
      label: "Selecione o cargo com a coluna Cargo",
      target: { strategy: "label", value: "Cargo", exact: true },
      value: { kind: "column", value: "Cargo" },
      risk: "medium",
    }),
    {
      id: crypto.randomUUID(),
      type: "condition",
      label: "Cursos para Motorista",
      enabled: true,
      risk: "medium",
      condition: { column: "Cargo", operator: "equals", value: "Motorista" },
      thenSteps: [
        atomic({
          type: "check",
          label: "Marque “Direção defensiva”",
          target: {
            strategy: "label",
            value: "Direção defensiva",
            exact: true,
          },
          risk: "medium",
        }),
        atomic({
          type: "check",
          label: "Marque “Segurança operacional”",
          target: {
            strategy: "label",
            value: "Segurança operacional",
            exact: true,
          },
          risk: "medium",
        }),
      ],
    },
    {
      id: crypto.randomUUID(),
      type: "condition",
      label: "Cursos para Gestor",
      enabled: true,
      risk: "medium",
      condition: { column: "Cargo", operator: "equals", value: "Gestor" },
      thenSteps: [
        atomic({
          type: "check",
          label: "Marque “Liderança”",
          target: { strategy: "label", value: "Liderança", exact: true },
          risk: "medium",
        }),
        atomic({
          type: "check",
          label: "Marque “Compliance”",
          target: { strategy: "label", value: "Compliance", exact: true },
          risk: "medium",
        }),
      ],
    },
    atomic({
      type: "click",
      label: "Clique no botão “Salvar”",
      target: {
        strategy: "role",
        role: "button",
        value: "Salvar",
        exact: true,
      },
      risk: "high",
    }),
    atomic({
      type: "verify",
      label: "Confirme que aparece “Colaborador cadastrado”",
      target: {
        strategy: "text",
        value: "Colaborador cadastrado",
        exact: true,
      },
    }),
  ];
  return {
    id: crypto.randomUUID(),
    name,
    description:
      "Cadastra colaboradores no portal de cursos e atribui trilhas conforme o cargo.",
    area: "rh",
    status: "draft",
    version: 1,
    createdAt: now,
    updatedAt: now,
    domains: [new URL(demoUrl).hostname],
    steps,
    dataSet: createDemoDataSet(),
    sensitiveColumns: ["E-mail"],
    browserChannel: "msedge",
    runHeaded: true,
    isExample: true,
  };
}

export function createBlankRoutine(input: {
  name: string;
  description: string;
  area: Routine["area"];
  url: string;
  dataSet?: DataSet;
}): Routine {
  const now = new Date().toISOString();
  const url = input.url.trim();
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    description: input.description.trim(),
    area: input.area,
    status: "draft",
    version: 1,
    createdAt: now,
    updatedAt: now,
    domains: [new URL(url).hostname],
    steps: [
      atomic({
        type: "open",
        label: `Abra ${new URL(url).hostname}`,
        url: { kind: "fixed", value: url },
      }),
    ],
    dataSet: input.dataSet,
    sensitiveColumns: [],
    browserChannel: "msedge",
    runHeaded: true,
  };
}

export function starterStep(type: RoutineStep["type"]): RoutineStep {
  const common = {
    id: crypto.randomUUID(),
    enabled: true,
    risk: "low" as const,
  };
  switch (type) {
    case "open":
      return {
        ...common,
        type,
        label: "Abra uma página",
        url: { kind: "fixed", value: "https://" },
      };
    case "click":
      return {
        ...common,
        type,
        label: "Clique em um botão",
        target: {
          strategy: "role",
          role: "button",
          value: "Nome do botão",
          exact: true,
        },
        risk: "high",
      };
    case "fill":
      return {
        ...common,
        type,
        label: "Preencha um campo",
        target: { strategy: "label", value: "Nome do campo", exact: true },
        value: { kind: "fixed", value: "" },
        risk: "medium",
      };
    case "select":
      return {
        ...common,
        type,
        label: "Selecione uma opção",
        target: { strategy: "label", value: "Nome do campo", exact: true },
        value: { kind: "fixed", value: "" },
        risk: "medium",
      };
    case "check":
      return {
        ...common,
        type,
        label: "Marque uma opção",
        target: { strategy: "label", value: "Nome da opção", exact: true },
        risk: "medium",
      };
    case "verify":
      return {
        ...common,
        type,
        label: "Confirme um resultado",
        target: { strategy: "text", value: "Texto esperado", exact: true },
      };
    case "wait":
      return { ...common, type, label: "Aguarde a página", durationMs: 1000 };
    case "checkpoint":
      return {
        ...common,
        type,
        label: "Pausa para você",
        message: "Conclua a ação no navegador e continue.",
      };
    case "screenshot":
      return { ...common, type, label: "Registre uma evidência" };
    case "condition":
      return {
        ...common,
        type,
        label: "Nova regra",
        condition: { column: "", operator: "equals", value: "" },
        thenSteps: [],
      };
  }
}
