export type CalendarView = "month" | "week" | "day" | "agenda"

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  start: Date
  end: Date
  allDay?: boolean
  color?: EventColor
  location?: string
  detalheId?: string  // ID para buscar detalhes adicionais (professor)
  source?: "totvs" | "ava"
  deadlineAt?: Date | string
  href?: string
  courseName?: string
}

export type EventColor =
  | "sky"
  | "amber"
  | "violet"
  | "rose"
  | "emerald"
  | "orange"
  | "green" // Cor primária do SapoConnect (#00ac93)
