import type { jsPDF as JsPdfDocument } from 'jspdf'

import type { Aula } from '@/types/calendario'

type Rgb = readonly [number, number, number]

const WEEK_DAYS = [
  { dayNumber: 2, label: 'Segunda', short: 'SEG' },
  { dayNumber: 3, label: 'Terça', short: 'TER' },
  { dayNumber: 4, label: 'Quarta', short: 'QUA' },
  { dayNumber: 5, label: 'Quinta', short: 'QUI' },
  { dayNumber: 6, label: 'Sexta', short: 'SEX' },
  { dayNumber: 7, label: 'Sábado', short: 'SÁB' },
] as const

const START_HOUR = 7
const END_HOUR = 22
const CELL_HEIGHT = 8.62
const PAGE_MARGIN = 10
const MASTHEAD_HEIGHT = 43
const SCHEDULE_GRID_START_Y = 47

const COLORS = {
  night: [7, 14, 24] as Rgb,
  nightRaised: [17, 31, 45] as Rgb,
  nightLine: [29, 65, 70] as Rgb,
  primary: [0, 203, 171] as Rgb,
  primaryDark: [0, 133, 113] as Rgb,
  primarySoft: [221, 248, 242] as Rgb,
  text: [20, 29, 42] as Rgb,
  muted: [96, 111, 128] as Rgb,
  surface: [255, 255, 255] as Rgb,
  canvas: [244, 247, 248] as Rgb,
  canvasAlt: [237, 242, 244] as Rgb,
  border: [207, 218, 222] as Rgb,
}

const DISCIPLINE_THEMES = [
  { accent: [0, 177, 148] as Rgb, fill: [224, 247, 241] as Rgb },
  { accent: [38, 112, 222] as Rgb, fill: [229, 239, 253] as Rgb },
  { accent: [117, 73, 218] as Rgb, fill: [239, 233, 252] as Rgb },
  { accent: [223, 143, 27] as Rgb, fill: [253, 244, 222] as Rgb },
  { accent: [218, 75, 91] as Rgb, fill: [253, 232, 235] as Rgb },
  { accent: [33, 143, 138] as Rgb, fill: [225, 246, 244] as Rgb },
]

export interface WeeklyExportBlock {
  aula: Aula
  dayIndex: number
  startHour: number
  endHour: number
}

export interface SubjectExportSummary {
  disciplina: string
  turma: string
  subturma: string
  sessions: Array<{
    dayIndex: number
    startHour: number
    endHour: number
  }>
}

type CalendarPdfOptions = {
  brandDataUrl?: string
}

function setFill(doc: JsPdfDocument, color: Rgb) {
  doc.setFillColor(color[0], color[1], color[2])
}

function setStroke(doc: JsPdfDocument, color: Rgb) {
  doc.setDrawColor(color[0], color[1], color[2])
}

function setText(doc: JsPdfDocument, color: Rgb) {
  doc.setTextColor(color[0], color[1], color[2])
}

function parseTime(value: string): number {
  const [hours = '0', minutes = '0'] = value.trim().replace(/[h.]/i, ':').split(':')
  return Number.parseInt(hours, 10) + Number.parseInt(minutes, 10) / 60
}

function formatTime(value: number): string {
  const hours = Math.floor(value)
  const minutes = Math.round((value - hours) * 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function normalizeKeyPart(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
}

function getClassKey(aula: Aula): string {
  return [
    aula.disciplina,
    aula.turma,
    aula.subturma,
    aula.dia_num.toString(),
    aula.inicio,
    aula.fim,
  ].map(normalizeKeyPart).join('|')
}

function getFrequencyKey(aula: Aula): string {
  return [aula.disciplina, aula.turma, aula.subturma, aula.dia_num.toString(), aula.inicio]
    .map(normalizeKeyPart)
    .join('|')
}

function selectRecurringClasses(aulas: Aula[]): Aula[] {
  const frequencies = new Map<string, number>()
  for (const aula of aulas) {
    const key = getFrequencyKey(aula)
    frequencies.set(key, (frequencies.get(key) ?? 0) + 1)
  }

  const recurring = aulas.filter((aula) => (frequencies.get(getFrequencyKey(aula)) ?? 0) >= 5)
  const source = recurring.length > 0 ? recurring : aulas
  return Array.from(new Map(source.map((aula) => [getClassKey(aula), aula])).values())
}

function prepareSchedule(aulas: Aula[]): WeeklyExportBlock[] {
  const dayIndex = new Map<number, number>(WEEK_DAYS.map((day, index) => [day.dayNumber, index]))

  return aulas.flatMap((aula) => {
    let index = dayIndex.get(aula.dia_num)
    if (index === undefined && aula.data_inicial_iso) {
      const date = new Date(aula.data_inicial_iso)
      index = dayIndex.get(date.getDay() + 1)
    }
    if (index === undefined) return []

    const startHour = parseTime(aula.inicio)
    const endHour = parseTime(aula.fim)
    if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour <= START_HOUR || startHour >= END_HOUR) return []

    return [{ aula, dayIndex: index, startHour, endHour }]
  })
}

function hasSameClassIdentity(current: WeeklyExportBlock, next: WeeklyExportBlock): boolean {
  const currentClass = current.aula
  const nextClass = next.aula
  return current.dayIndex === next.dayIndex
    && normalizeKeyPart(currentClass.disciplina) === normalizeKeyPart(nextClass.disciplina)
    && normalizeKeyPart(currentClass.turma) === normalizeKeyPart(nextClass.turma)
    && normalizeKeyPart(currentClass.subturma) === normalizeKeyPart(nextClass.subturma)
}

function mergeConsecutivePeriods(schedule: WeeklyExportBlock[]): WeeklyExportBlock[] {
  const sorted = [...schedule].sort((a, b) =>
    a.dayIndex - b.dayIndex
    || a.startHour - b.startHour
    || a.aula.disciplina.localeCompare(b.aula.disciplina, 'pt-BR'),
  )
  const merged: WeeklyExportBlock[] = []

  for (const block of sorted) {
    const previous = merged.at(-1)
    const gapInMinutes = previous ? (block.startHour - previous.endHour) * 60 : Number.POSITIVE_INFINITY
    const shouldMerge = previous
      && hasSameClassIdentity(previous, block)
      && gapInMinutes >= -3
      && gapInMinutes <= 15

    if (shouldMerge) {
      previous.endHour = Math.max(previous.endHour, block.endHour)
      continue
    }

    merged.push({ ...block })
  }

  return merged
}

export function prepareWeeklyBlocksForExport(aulas: Aula[]): WeeklyExportBlock[] {
  return mergeConsecutivePeriods(prepareSchedule(selectRecurringClasses(aulas)))
}

export function summarizeSubjectsForExport(schedule: WeeklyExportBlock[]): SubjectExportSummary[] {
  const subjects = new Map<string, SubjectExportSummary>()
  for (const block of schedule) {
    const key = [block.aula.disciplina, block.aula.turma, block.aula.subturma]
      .map(normalizeKeyPart)
      .join('|')
    const subject = subjects.get(key) ?? {
      disciplina: block.aula.disciplina,
      turma: block.aula.turma,
      subturma: block.aula.subturma,
      sessions: [],
    }
    subject.sessions.push({
      dayIndex: block.dayIndex,
      startHour: block.startHour,
      endHour: block.endHour,
    })
    subjects.set(key, subject)
  }

  return Array.from(subjects.values())
    .map((subject) => ({
      ...subject,
      sessions: subject.sessions.sort((a, b) => a.dayIndex - b.dayIndex || a.startHour - b.startHour),
    }))
    .sort((a, b) => a.disciplina.localeCompare(b.disciplina, 'pt-BR'))
}

function getTheme(label: string) {
  const hash = Array.from(label).reduce((total, character) => total + character.charCodeAt(0), 0)
  return DISCIPLINE_THEMES[Math.abs(hash) % DISCIPLINE_THEMES.length]
}

function truncateToWidth(doc: JsPdfDocument, value: string, width: number): string {
  if (doc.getTextWidth(value) <= width) return value
  let output = value
  while (output.length > 1 && doc.getTextWidth(`${output}...`) > width) output = output.slice(0, -1)
  return `${output.trimEnd()}...`
}

function drawBrand(doc: JsPdfDocument, x: number, y: number, brandDataUrl?: string, compact = false) {
  const size = compact ? 10 : 15
  if (brandDataUrl) {
    doc.addImage(brandDataUrl, 'PNG', x, y, size, size, undefined, 'FAST')
  } else {
    setFill(doc, COLORS.nightRaised)
    doc.roundedRect(x, y, size, size, compact ? 2.3 : 3.2, compact ? 2.3 : 3.2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(compact ? 6.2 : 8)
    setText(doc, COLORS.surface)
    doc.text('S', x + size * 0.37, y + size * 0.63, { align: 'center' })
    setText(doc, COLORS.primary)
    doc.text('C', x + size * 0.67, y + size * 0.63, { align: 'center' })
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(compact ? 8.5 : 10.5)
  setText(doc, COLORS.surface)
  doc.text('Sapo', x + size + 3, y + (compact ? 4.6 : 6.3))
  const sapoWidth = doc.getTextWidth('Sapo')
  setText(doc, COLORS.primary)
  doc.text('Connect', x + size + 3 + sapoWidth, y + (compact ? 4.6 : 6.3))

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(compact ? 4.6 : 5.5)
  setText(doc, [166, 181, 194])
  doc.text('de aluno para aluno', x + size + 3, y + (compact ? 8.2 : 11))
}

function drawOrbitMotif(doc: JsPdfDocument, pageWidth: number) {
  setStroke(doc, COLORS.nightLine)
  doc.setLineWidth(0.25)
  doc.circle(pageWidth + 1, 15, 25, 'S')
  doc.circle(pageWidth + 1, 15, 17, 'S')
  doc.circle(pageWidth + 1, 15, 9, 'S')
  doc.line(pageWidth - 37, 0, pageWidth, 37)
  doc.line(pageWidth - 24, 0, pageWidth, 24)
}

function drawMasthead(
  doc: JsPdfDocument,
  schedule: WeeklyExportBlock[],
  subjects: SubjectExportSummary[],
  ra: string | undefined,
  generatedAt: Date,
  brandDataUrl?: string,
) {
  const pageWidth = doc.internal.pageSize.getWidth()
  setFill(doc, COLORS.night)
  doc.rect(0, 0, pageWidth, MASTHEAD_HEIGHT, 'F')
  setFill(doc, COLORS.primary)
  doc.rect(0, 0, pageWidth, 1.25, 'F')
  drawOrbitMotif(doc, pageWidth)
  drawBrand(doc, 13, 6.5, brandDataUrl, true)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16.5)
  setText(doc, COLORS.surface)
  doc.text('Horário semanal', 13, 33.5)

  const accountX = pageWidth - 60
  setFill(doc, COLORS.nightRaised)
  doc.roundedRect(accountX, 6.5, 47, 15.5, 3.5, 3.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.8)
  setText(doc, COLORS.primary)
  doc.text('RA', accountX + 5, 12.4, { charSpace: 0.35 })
  doc.setFontSize(7.4)
  setText(doc, COLORS.surface)
  doc.text(ra || 'Não informado', accountX + 5, 18.3)

  const metricY = 27.2
  const metricLabelY = 34
  const metrics = [
    { x: 96, value: `${subjects.length}`, label: 'disciplinas' },
    { x: 132, value: `${schedule.length}`, label: 'blocos semanais' },
    { x: 180, value: `${formatTime(START_HOUR)} - ${formatTime(END_HOUR)}`, label: 'faixa horária' },
  ]
  metrics.forEach((metric, index) => {
    if (index > 0) {
      setStroke(doc, COLORS.nightLine)
      doc.setLineWidth(0.25)
      doc.line(metric.x - 8, 25.3, metric.x - 8, 35.4)
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    setText(doc, COLORS.surface)
    doc.text(metric.value, metric.x, metricY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5)
    setText(doc, [151, 167, 181])
    doc.text(metric.label, metric.x, metricLabelY)
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.8)
  setText(doc, [152, 168, 181])
  doc.text(`Gerado em ${generatedAt.toLocaleDateString('pt-BR')}`, pageWidth - 13, 34, { align: 'right' })
}

function drawScheduleGrid(doc: JsPdfDocument, schedule: WeeklyExportBlock[], startY: number) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const usableWidth = pageWidth - PAGE_MARGIN * 2
  const timeColumnWidth = 15
  const dayColumnWidth = (usableWidth - timeColumnWidth) / WEEK_DAYS.length
  const headerHeight = 9.5
  const gridHeight = (END_HOUR - START_HOUR) * CELL_HEIGHT
  const gridY = startY + headerHeight

  setFill(doc, COLORS.nightRaised)
  doc.roundedRect(PAGE_MARGIN, startY, usableWidth, headerHeight, 2.7, 2.7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.9)
  setText(doc, [172, 186, 199])
  doc.text('HORA', PAGE_MARGIN + timeColumnWidth / 2, startY + 6.2, { align: 'center', charSpace: 0.25 })
  WEEK_DAYS.forEach((day, index) => {
    const x = PAGE_MARGIN + timeColumnWidth + index * dayColumnWidth
    setText(doc, index === WEEK_DAYS.length - 1 ? COLORS.primary : COLORS.surface)
    doc.text(day.label.toUpperCase(), x + dayColumnWidth / 2, startY + 6.2, { align: 'center', charSpace: 0.2 })
  })

  setFill(doc, COLORS.surface)
  doc.rect(PAGE_MARGIN, gridY, usableWidth, gridHeight, 'F')
  for (let hour = START_HOUR; hour < END_HOUR; hour += 1) {
    const rowY = gridY + (hour - START_HOUR) * CELL_HEIGHT
    if ((hour - START_HOUR) % 2 === 1) {
      setFill(doc, COLORS.canvasAlt)
      doc.rect(PAGE_MARGIN, rowY, usableWidth, CELL_HEIGHT, 'F')
    }
    setStroke(doc, COLORS.border)
    doc.setLineWidth(0.16)
    doc.line(PAGE_MARGIN, rowY, PAGE_MARGIN + usableWidth, rowY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.1)
    setText(doc, COLORS.muted)
    doc.text(`${hour.toString().padStart(2, '0')}:00`, PAGE_MARGIN + timeColumnWidth / 2, rowY + 2.4, { align: 'center' })
  }
  setStroke(doc, COLORS.border)
  doc.line(PAGE_MARGIN, gridY + gridHeight, PAGE_MARGIN + usableWidth, gridY + gridHeight)
  for (let column = 0; column <= WEEK_DAYS.length; column += 1) {
    const x = PAGE_MARGIN + timeColumnWidth + column * dayColumnWidth
    doc.line(x, gridY, x, gridY + gridHeight)
  }

  for (const scheduledClass of schedule) {
    const { aula, dayIndex, startHour, endHour } = scheduledClass
    const top = gridY + (Math.max(startHour, START_HOUR) - START_HOUR) * CELL_HEIGHT + 0.65
    const bottom = gridY + (Math.min(endHour, END_HOUR) - START_HOUR) * CELL_HEIGHT - 0.65
    const height = Math.max(bottom - top, 4.2)
    const left = PAGE_MARGIN + timeColumnWidth + dayIndex * dayColumnWidth + 0.75
    const width = dayColumnWidth - 1.5
    const theme = getTheme(aula.disciplina)

    setFill(doc, [220, 227, 229])
    doc.roundedRect(left + 0.45, top + 0.55, width, height, 1.8, 1.8, 'F')
    setFill(doc, theme.fill)
    doc.roundedRect(left, top, width, height, 1.8, 1.8, 'F')
    setFill(doc, theme.accent)
    doc.roundedRect(left, top, 1.55, height, 0.8, 0.8, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(height >= 10 ? 5.7 : 5.1)
    setText(doc, COLORS.text)
    const lines = doc.splitTextToSize(aula.disciplina, width - 4.5) as string[]
    doc.text(lines.slice(0, height >= 12 ? 2 : 1), left + 3, top + 3.2)

    if (height >= 10) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(4.65)
      setText(doc, COLORS.muted)
      const detail = `${formatTime(startHour)} - ${formatTime(endHour)}`
      doc.text(truncateToWidth(doc, detail, width - 5), left + 3, top + height - 1.8)
    }
  }
}

function drawContinuationHeader(
  doc: JsPdfDocument,
  title: string,
  pageLabel: string,
  ra: string | undefined,
  brandDataUrl?: string,
) {
  const pageWidth = doc.internal.pageSize.getWidth()
  setFill(doc, COLORS.night)
  doc.rect(0, 0, pageWidth, 25, 'F')
  setFill(doc, COLORS.primary)
  doc.rect(0, 0, pageWidth, 1.4, 'F')
  drawBrand(doc, 12, 7, brandDataUrl, true)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  setText(doc, COLORS.surface)
  doc.text(title, 72, 15.4)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  setText(doc, COLORS.primary)
  doc.text(`${pageLabel}${ra ? ` · RA ${ra}` : ''}`, pageWidth - 12, 12.5, { align: 'right', charSpace: 0.2 })
}

function formatSessions(doc: JsPdfDocument, subject: SubjectExportSummary, width: number): string {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.1)
  const value = subject.sessions.map((session) => {
    const day = WEEK_DAYS[session.dayIndex]?.short ?? ''
    return `${day} ${formatTime(session.startHour)}-${formatTime(session.endHour)}`
  }).join('  |  ')
  return truncateToWidth(doc, value, width)
}

function drawSubjectCard(
  doc: JsPdfDocument,
  subject: SubjectExportSummary,
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const theme = getTheme(subject.disciplina)
  setFill(doc, [220, 226, 229])
  doc.roundedRect(x + 0.45, y + 0.55, width, height, 3, 3, 'F')
  setFill(doc, COLORS.surface)
  setStroke(doc, COLORS.border)
  doc.setLineWidth(0.18)
  doc.roundedRect(x, y, width, height, 3, 3, 'FD')
  setFill(doc, theme.accent)
  doc.roundedRect(x + 3, y + 3, 11, height - 6, 2.2, 2.2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.3)
  setText(doc, COLORS.surface)
  doc.text(String(index + 1).padStart(2, '0'), x + 8.5, y + height / 2 + 1.1, { align: 'center' })

  const titleX = x + 18
  const metaWidth = 32
  const titleWidth = width - 18 - metaWidth - 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.4)
  setText(doc, COLORS.text)
  const titleLines = doc.splitTextToSize(subject.disciplina, titleWidth) as string[]
  doc.text(titleLines.slice(0, 2), titleX, y + 5.6, { lineHeightFactor: 1.04 })

  const metaX = x + width - metaWidth
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.4)
  setText(doc, COLORS.primaryDark)
  doc.text('TURMA / SUBTURMA', metaX, y + 5, { charSpace: 0.15 })
  doc.setFontSize(5.7)
  setText(doc, COLORS.text)
  doc.text(truncateToWidth(doc, `${subject.turma || '-'} · ${subject.subturma || '-'}`, metaWidth - 3), metaX, y + 9.7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.1)
  setText(doc, COLORS.muted)
  doc.text(formatSessions(doc, subject, width - 23), titleX, y + height - 3.4)
}

function drawSubjects(
  doc: JsPdfDocument,
  subjects: SubjectExportSummary[],
  schedule: WeeklyExportBlock[],
  ra: string | undefined,
  generatedAt: Date,
  brandDataUrl?: string,
) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const gapX = 3.2
  const gapY = 2.2
  const columnWidth = (pageWidth - PAGE_MARGIN * 2 - gapX) / 2
  const cardHeight = 19.8
  const cardsPerPage = 14

  for (let pageStart = 0; pageStart < subjects.length; pageStart += cardsPerPage) {
    if (pageStart > 0) doc.addPage()
    setFill(doc, COLORS.canvas)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
    const pageNumber = Math.floor(pageStart / cardsPerPage) + 1
    drawContinuationHeader(
      doc,
      pageNumber === 1 ? 'Disciplinas da semana' : 'Disciplinas - continuação',
      `PÁGINA ${String(pageNumber + 1).padStart(2, '0')}`,
      ra,
      brandDataUrl,
    )

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.2)
    setText(doc, COLORS.primaryDark)
    doc.text(`${subjects.length} DISCIPLINAS`, PAGE_MARGIN, 32.5, { charSpace: 0.3 })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.5)
    setText(doc, COLORS.muted)
    doc.text(`${schedule.length} blocos recorrentes · atualizado em ${generatedAt.toLocaleDateString('pt-BR')}`, PAGE_MARGIN + 35, 32.5)
    setStroke(doc, COLORS.border)
    doc.setLineWidth(0.2)
    doc.line(PAGE_MARGIN, 35.5, pageWidth - PAGE_MARGIN, 35.5)

    subjects.slice(pageStart, pageStart + cardsPerPage).forEach((subject, pageIndex) => {
      const row = Math.floor(pageIndex / 2)
      const column = pageIndex % 2
      const x = PAGE_MARGIN + column * (columnWidth + gapX)
      const y = 39 + row * (cardHeight + gapY)
      drawSubjectCard(doc, subject, pageStart + pageIndex, x, y, columnWidth, cardHeight)
    })
  }
}

function drawEmptyState(doc: JsPdfDocument, generatedAt: Date) {
  const pageWidth = doc.internal.pageSize.getWidth()
  setFill(doc, COLORS.surface)
  doc.roundedRect(78, 84, pageWidth - 156, 54, 7, 7, 'F')
  setStroke(doc, COLORS.border)
  doc.roundedRect(78, 84, pageWidth - 156, 54, 7, 7, 'S')
  setFill(doc, COLORS.primarySoft)
  doc.circle(pageWidth / 2, 100, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  setText(doc, COLORS.text)
  doc.text('Nenhuma aula disponível para exportação.', pageWidth / 2, 117, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setText(doc, COLORS.muted)
  doc.text(`Atualize os horários no aplicativo e tente novamente. Gerado em ${generatedAt.toLocaleDateString('pt-BR')}.`, pageWidth / 2, 126, { align: 'center' })
}

function drawFooters(doc: JsPdfDocument) {
  const pageCount = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    setStroke(doc, COLORS.border)
    doc.setLineWidth(0.2)
    doc.line(PAGE_MARGIN, pageHeight - 7.5, pageWidth - PAGE_MARGIN, pageHeight - 7.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.1)
    setText(doc, COLORS.muted)
    doc.text('Horários sujeitos a alterações. Confirme avisos acadêmicos no portal oficial.', PAGE_MARGIN, pageHeight - 4.2)
    doc.setFont('helvetica', 'bold')
    setText(doc, COLORS.primaryDark)
    doc.text(`SAPOCONNECT · ${String(page).padStart(2, '0')} / ${String(pageCount).padStart(2, '0')}`, pageWidth - PAGE_MARGIN, pageHeight - 4.2, { align: 'right', charSpace: 0.15 })
  }
}

export async function buildCalendarioPDF(
  aulas: Aula[],
  alunoRa?: string,
  generatedAt = new Date(),
  options: CalendarPdfOptions = {},
): Promise<JsPdfDocument> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  doc.setProperties({
    title: 'Horário semanal - SapoConnect',
    subject: 'Horário semanal',
    author: 'SapoConnect',
    creator: 'SapoConnect',
  })

  const schedule = prepareWeeklyBlocksForExport(aulas ?? [])
  const subjects = summarizeSubjectsForExport(schedule)
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  setFill(doc, COLORS.canvas)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')
  drawMasthead(doc, schedule, subjects, alunoRa, generatedAt, options.brandDataUrl)

  if (schedule.length === 0) {
    drawEmptyState(doc, generatedAt)
    drawFooters(doc)
    return doc
  }

  drawScheduleGrid(doc, schedule, SCHEDULE_GRID_START_Y)
  doc.addPage()
  drawSubjects(doc, subjects, schedule, alunoRa, generatedAt, options.brandDataUrl)
  drawFooters(doc)
  return doc
}

export async function exportCalendarioToPDF(aulas: Aula[], alunoRa?: string): Promise<void> {
  let brandDataUrl: string | undefined
  try {
    const response = await fetch('/brand/sapoconnect-icon-96.png', { cache: 'force-cache' })
    if (response.ok) {
      const logoBlob = await response.blob()
      brandDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(reader.error)
        reader.onload = () => resolve(String(reader.result))
        reader.readAsDataURL(logoBlob)
      })
    }
  } catch {
    brandDataUrl = undefined
  }

  const doc = await buildCalendarioPDF(aulas, alunoRa, new Date(), { brandDataUrl })
  doc.save('sapoconnect-horario-semanal.pdf')
}
