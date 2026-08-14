import { describe, expect, it } from "vitest"

import { calculateEvaluationLaunchProgress } from "@/lib/evaluation-progress"

describe("calculateEvaluationLaunchProgress", () => {
  it("does not count special assessments as launched or pending notes", () => {
    const progress = calculateEvaluationLaunchProgress([
      {
        nome: "Avaliação Parcial",
        avaliacoes: [
          { nome: "Prova 1", nota: "18,5" },
          { nome: "Prova 2" },
        ],
      },
      {
        nome: "Exame Especial",
        avaliacoes: [
          { nome: "Exame Especial", nota: "62,0" },
          { nome: "Segunda chamada especial" },
        ],
      },
    ])

    expect(progress).toEqual({ launched: 1, total: 2, percentage: 50 })
  })

  it("recognizes special assessments by category or assessment name", () => {
    const progress = calculateEvaluationLaunchProgress([
      {
        nome: "Recuperação",
        avaliacoes: [
          { nome: "Avaliação especial", nota: "55" },
          { nome: "Atividade regular", nota: "10" },
        ],
      },
    ])

    expect(progress).toEqual({ launched: 1, total: 1, percentage: 100 })
  })
})
