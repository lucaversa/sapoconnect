export type EvaluationLaunchItem = {
  nome: string
  nota?: string
}

export type EvaluationLaunchCategory = {
  nome: string
  avaliacoes: EvaluationLaunchItem[]
}

function normalizeEvaluationLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function isSpecialEvaluation(categoryName: string, evaluationName: string): boolean {
  return `${normalizeEvaluationLabel(categoryName)} ${normalizeEvaluationLabel(evaluationName)}`.includes("especial")
}

function hasLaunchedGrade(value?: string): boolean {
  if (value === undefined || value === null || value.trim() === "") return false
  return !Number.isNaN(Number.parseFloat(value.replace(",", ".")))
}

export function calculateEvaluationLaunchProgress(categories: EvaluationLaunchCategory[]) {
  const regularEvaluations = categories.flatMap((category) =>
    category.avaliacoes.filter((evaluation) => !isSpecialEvaluation(category.nome, evaluation.nome)),
  )
  const launched = regularEvaluations.filter((evaluation) => hasLaunchedGrade(evaluation.nota)).length
  const total = regularEvaluations.length

  return {
    launched,
    total,
    percentage: total > 0 ? (launched / total) * 100 : 0,
  }
}
