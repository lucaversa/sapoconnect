import { jsPDF } from 'jspdf'
import { Aula } from '@/types/calendario'

const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']

const START_HOUR = 7
const END_HOUR = 22
const CELL_HEIGHT = 13

const COLORS = {
    primary: [0, 172, 147],
    textDark: [30, 41, 59],
    textMuted: [107, 114, 128],
    bgCard: [255, 255, 255],
    bgLight: [248, 250, 252],
    border: [226, 232, 240],
}

const DISCIPLINA_COLORS = [
    { bg: [220, 252, 231], text: [34, 197, 94] },
    { bg: [254, 249, 195], text: [161, 98, 7] },
    { bg: [254, 226, 226], text: [220, 38, 38] },
    { bg: [234, 221, 255], text: [139, 92, 246] },
    { bg: [226, 240, 254], text: [59, 130, 246] },
    { bg: [255, 237, 213], text: [234, 88, 12] },
]

interface AulaComPosicao {
    aula: Aula
    dia: string
    diaIdx: number
    horaInicio: number
    horaFim: number
}

function parseHora(hora: string): number {
    const cleaned = hora.trim().replace('h', '').replace(':', '.')
    const parts = cleaned.split('.')
    const hours = parseInt(parts[0] || '0', 10)
    const minutes = parseInt(parts[1] || '0', 10)
    return hours + minutes / 60
}

function formatHora(hora: number): string {
    const hours = Math.floor(hora)
    const minutes = Math.round((hora - hours) * 60)
    if (minutes === 0) {
        return `${hours.toString().padStart(2, '0')}:00`
    }
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function contarFrequenciaAulas(aulas: Aula[]): Map<string, number> {
    const frequencia = new Map<string, number>()
    for (const aula of aulas) {
        // Conta frequência por: disciplina + turma + horário (dia da semana + hora)
        // Ex: "SAÚDE DA MULHER I | M80D626.1 | 2 | 09:45" (dia_num=2=Segunda, horário=09:45)
        const chave = `${aula.disciplina}|${aula.turma}|${aula.dia_num}|${aula.inicio}`
        frequencia.set(chave, (frequencia.get(chave) || 0) + 1)
    }
    return frequencia
}

function filtrarAulasFrequentes(aulas: Aula[], frequencia: Map<string, number>): Aula[] {
    // Filtra aulas que aparecem 5+ vezes no mesmo dia/horário
    return aulas.filter(aula => {
        const chave = `${aula.disciplina}|${aula.turma}|${aula.dia_num}|${aula.inicio}`
        const count = frequencia.get(chave) || 0
        return count >= 5
    })
}

function prepareAulasForGrid(aulas: Aula[]): AulaComPosicao[] {
    const result: AulaComPosicao[] = []
    // dia_num do HTML TOTVS: Dom=1, Seg=2, Ter=3, Qua=4, Qui=5, Sex=6, Sáb=7
    // Queremos: Seg→0, Ter→1, Qua→2, Qui→3, Sex→4
    const diaNumToIndex: Record<number, number> = { 2: 0, 3: 1, 4: 2, 5: 3, 6: 4 }

    console.log('[PREPARE GRID] Processando', aulas.length, 'aulas')

    for (const aula of aulas) {
        let diaIdx = -1

        // PRIORIZA dia_num (posição no HTML) sobre data_inicial_iso
        if (aula.dia_num >= 2 && aula.dia_num <= 6) {
            diaIdx = diaNumToIndex[aula.dia_num]
        }

        // Fallback: tenta usar a data se não tiver dia_num válido
        if (diaIdx === -1 && aula.data_inicial_iso) {
            const data = new Date(aula.data_inicial_iso)
            const jsDay = data.getDay() // 0=Dom, 1=Seg, 2=Ter...
            if (jsDay >= 1 && jsDay <= 5) {
                diaIdx = jsDay - 1 // Seg(1)→0, Ter(2)→1, etc.
            }
        }

        if (diaIdx < 0 || diaIdx > 4) {
            console.log('[PREPARE GRID] Aula descartada - diaIdx inválido:', {
                disciplina: aula.disciplina,
                dia_num: aula.dia_num,
                dia: aula.dia,
                diaIdx,
                data_inicial_iso: aula.data_inicial_iso,
            })
            continue
        }

        const horaInicio = parseHora(aula.inicio)
        const horaFim = parseHora(aula.fim)

        if (horaFim <= START_HOUR || horaInicio >= END_HOUR) continue

        result.push({
            aula,
            dia: DIAS_SEMANA[diaIdx],
            diaIdx,
            horaInicio,
            horaFim,
        })
    }

    // Log final com contagem por dia
    const porDia = [0, 0, 0, 0, 0]
    result.forEach(r => porDia[r.diaIdx]++)
    console.log('[PREPARE GRID] Aulas por dia (Seg-Sex):', porDia)
    console.log('[PREPARE GRID] Total de aulas na grade:', result.length)

    return result
}

function extractMaterias(aulas: Aula[]): Array<{ disciplina: string; turma: string; subturma: string }> {
    const unique = new Map<string, { disciplina: string; turma: string; subturma: string }>()

    for (const aula of aulas) {
        const key = `${aula.disciplina}|${aula.turma}|${aula.subturma}`
        if (!unique.has(key)) {
            unique.set(key, {
                disciplina: aula.disciplina,
                turma: aula.turma,
                subturma: aula.subturma,
            })
        }
    }

    return Array.from(unique.values()).sort((a, b) => a.disciplina.localeCompare(b.disciplina))
}

async function loadImageAsBase64(url: string): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                resolve(null)
                return
            }
            ctx.drawImage(img, 0, 0)
            resolve(canvas.toDataURL('image/png'))
        }
        img.onerror = () => resolve(null)
        img.src = url
    })
}

export async function exportCalendarioToPDF(aulas: Aula[], alunoNome?: string): Promise<void> {
    // DEBUG: Log para entender os dados
    console.log('[CALENDAR EXPORT] Total de aulas:', aulas.length)
    console.log('[CALENDAR EXPORT] Amostra de aulas:', aulas.slice(0, 10).map(a => ({
        disciplina: a.disciplina,
        dia_num: a.dia_num,
        dia: a.dia,
        data_inicial_iso: a.data_inicial_iso,
        inicio: a.inicio,
    })))

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    const margin = 14
    const usableWidth = pageWidth - 2 * margin

    const headerHeight = 16
    const timeColWidth = 18
    const dayColWidth = (usableWidth - timeColWidth) / 5
    const totalHours = END_HOUR - START_HOUR

    // ===== CARREGAR LOGO =====
    const sapoImage = await loadImageAsBase64('/sapo.png')

    // ===== HEADER PRINCIPAL =====
    let y = margin

    // Logo do sapo
    if (sapoImage) {
        doc.addImage(sapoImage, 'PNG', margin, y, 12, 12)
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2])
    doc.text('Sapo', margin + 14, y + 8)
    const sapoWidth = doc.getTextWidth('Sapo')
    doc.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2])
    doc.text('Connect', margin + 14 + sapoWidth, y + 8)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2])
    doc.text('Horário Semanal', pageWidth / 2, y + 7, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2])
    doc.text(`RA: ${alunoNome || '-'}`, pageWidth / 2, y + 12, { align: 'center' })

    const dataGeracao = new Date().toLocaleDateString('pt-BR')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2])
    doc.text(`Gerado: ${dataGeracao}`, pageWidth - margin, y + 8, { align: 'right' })

    y += 18

    if (!aulas || aulas.length === 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2])
        doc.text('Nenhuma aula cadastrada.', pageWidth / 2, y + 20, { align: 'center' })
        doc.save('horario-semanal.pdf')
        return
    }

    // ===== FILTRAR AULAS FREQUENTES =====
    const frequencia = contarFrequenciaAulas(aulas)
    const aulasFiltradas = filtrarAulasFrequentes(aulas, frequencia)

    console.log('[CALENDAR EXPORT] Antes do filtro:', aulas.length, 'aulas')
    console.log('[CALENDAR EXPORT] Depois do filtro (>=5x):', aulasFiltradas.length, 'aulas')

    // Mostra as chaves de frequência para debug
    const freqArray = Array.from(frequencia.entries()).sort((a, b) => b[1] - a[1])
    console.log('[CALENDAR EXPORT] Top 20 frequências:', freqArray.slice(0, 20).map(([chave, count]) => {
        const [disciplina, turma, diaNum, inicio] = chave.split('|')
        const diaNome = diaNum === '2' ? 'SEG' : diaNum === '3' ? 'TER' : diaNum === '4' ? 'QUA' : diaNum === '5' ? 'QUI' : diaNum === '6' ? 'SEX' : diaNum
        return { disciplina, turma, dia: diaNome, inicio, count }
    }))

    const aulasPreparadas = prepareAulasForGrid(aulasFiltradas)

    // ===== CABEÇALHO DOS DIAS =====
    const headerY = y

    doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2])
    doc.roundedRect(margin, headerY, usableWidth, headerHeight, 3, 3, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Hora', margin + timeColWidth / 2, headerY + headerHeight / 2 + 2.5, { align: 'center' })

    doc.setFontSize(9)
    for (let i = 0; i < 5; i++) {
        const xPos = margin + timeColWidth + i * dayColWidth
        doc.text(DIAS_SEMANA[i], xPos + dayColWidth / 2, headerY + headerHeight / 2 + 2.5, { align: 'center' })
    }

    y += headerHeight

    // ===== GRADE DE HORÁRIOS =====
    const gridStartY = y
    const gridHeight = (totalHours + 1) * CELL_HEIGHT

    doc.setFillColor(COLORS.bgCard[0], COLORS.bgCard[1], COLORS.bgCard[2])
    doc.rect(margin, gridStartY, usableWidth, gridHeight, 'F')

    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2])
    doc.setLineWidth(0.5)
    doc.rect(margin, gridStartY, usableWidth, gridHeight, 'S')

    // Linhas horizontais e horários
    for (let h = 0; h <= totalHours; h++) {
        const lineY = gridStartY + h * CELL_HEIGHT
        const hour = START_HOUR + h

        doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2])
        doc.rect(margin, lineY, usableWidth, CELL_HEIGHT, 'F')

        doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2])
        doc.setLineWidth(0.2)
        doc.line(margin, lineY, margin + usableWidth, lineY)

        doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2])
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.text(`${hour}:00`, margin + timeColWidth / 2, lineY + CELL_HEIGHT / 2 + 2, { align: 'center' })
    }

    // Linhas verticais
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2])
    doc.setLineWidth(0.3)
    for (let i = 1; i <= 5; i++) {
        const x = margin + timeColWidth + (i - 1) * dayColWidth
        doc.line(x, gridStartY, x, gridStartY + gridHeight)
    }
    doc.line(margin + timeColWidth, gridStartY, margin + timeColWidth, gridStartY + gridHeight)

    // ===== DESENHAR AULAS =====
    for (const aulaP of aulasPreparadas) {
        const { aula, diaIdx, horaInicio, horaFim } = aulaP

        let top = gridStartY + (horaInicio - START_HOUR) * CELL_HEIGHT + 1
        let height = (horaFim - horaInicio) * CELL_HEIGHT - 2
        let left = margin + timeColWidth + diaIdx * dayColWidth + 1.5
        let width = dayColWidth - 3

        const maxTop = gridStartY + gridHeight - CELL_HEIGHT
        top = Math.max(Math.min(top, maxTop), gridStartY)
        const maxAllowedHeight = maxTop - top + CELL_HEIGHT
        height = Math.max(Math.min(height, maxAllowedHeight), CELL_HEIGHT / 2)
        width = Math.max(width, 4)

        if (!isFinite(top) || !isFinite(height) || !isFinite(left) || !isFinite(width)) continue
        if (height < 4 || width < 4) continue

        const colorIndex = Math.abs(aula.disciplina.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % DISCIPLINA_COLORS.length
        const color = DISCIPLINA_COLORS[colorIndex]

        doc.setFillColor(color.bg[0], color.bg[1], color.bg[2])
        doc.roundedRect(left, top, width, height, 2, 2, 'F')

        doc.setTextColor(color.text[0], color.text[1], color.text[2])
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6)

        const textWidth = width * 0.9
        const lines = doc.splitTextToSize(aula.disciplina, textWidth)
        doc.text(lines.slice(0, 2), left + width / 2, top + 3, { align: 'center' })

        if (height > 12) {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(5.5)
            doc.setTextColor(255, 255, 255)
            const horarioTexto = `${formatHora(horaInicio)} - ${formatHora(horaFim)}`
            doc.text(horarioTexto, left + width / 2, top + height - 2.5, { align: 'center' })
        }
    }

    // ===== SEGUNDA PÁGINA: TABELA DE MATÉRIAS =====
    doc.addPage()
    y = margin

    // Logo do sapo na segunda página
    if (sapoImage) {
        doc.addImage(sapoImage, 'PNG', margin, y, 10, 10)
    }

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2])
    doc.text('Sapo', margin + 12, y + 7)
    const sapoWidth2 = doc.getTextWidth('Sapo')
    doc.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2])
    doc.text('Connect', margin + 12 + sapoWidth2, y + 7)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2])
    doc.text('Relação de Matérias', pageWidth / 2, y + 7, { align: 'center' })

    y += 16

    const materias = extractMaterias(aulasFiltradas)

    if (materias.length === 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2])
        doc.text('Nenhuma matéria com aulas frequentes.', pageWidth / 2, y + 15, { align: 'center' })
        doc.save('horario-semanal.pdf')
        return
    }

    const tableRowHeight = 9
    const tableHeaderY = y
    const colMat = usableWidth * 0.55
    const colTurma = usableWidth * 0.20
    const colSub = usableWidth * 0.25

    doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2])
    doc.roundedRect(margin, tableHeaderY, usableWidth, tableRowHeight, 2, 2, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Disciplina', margin + 8, tableHeaderY + tableRowHeight / 2 + 2)
    doc.text('Turma', margin + colMat + 5, tableHeaderY + tableRowHeight / 2 + 2)
    doc.text('Subturma', margin + colMat + colTurma + 5, tableHeaderY + tableRowHeight / 2 + 2)

    y = tableHeaderY + tableRowHeight

    for (let i = 0; i < materias.length; i++) {
        if (y + tableRowHeight > pageHeight - margin) {
            doc.addPage()
            y = margin

            doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2])
            doc.roundedRect(margin, y, usableWidth, tableRowHeight, 2, 2, 'F')

            doc.setTextColor(255, 255, 255)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8)
            doc.text('Disciplina', margin + 8, y + tableRowHeight / 2 + 2)
            doc.text('Turma', margin + colMat + 5, y + tableRowHeight / 2 + 2)
            doc.text('Subturma', margin + colMat + colTurma + 5, y + tableRowHeight / 2 + 2)

            y += tableRowHeight
        }

        doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2])
        doc.rect(margin, y, usableWidth, tableRowHeight, 'F')

        doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2])
        doc.setLineWidth(0.2)
        doc.line(margin, y + tableRowHeight, margin + usableWidth, y + tableRowHeight)

        const colorIndex = Math.abs(materias[i].disciplina.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % DISCIPLINA_COLORS.length
        const color = DISCIPLINA_COLORS[colorIndex]

        doc.setFillColor(color.bg[0], color.bg[1], color.bg[2])
        doc.roundedRect(margin + 2, y + 2, 2, tableRowHeight - 4, 1, 1, 'F')

        doc.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2])
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)

        const disciplinaTexto = materias[i].disciplina.length > 50
            ? materias[i].disciplina.substring(0, 48) + '...'
            : materias[i].disciplina
        doc.text(disciplinaTexto, margin + 7, y + tableRowHeight / 2 + 2)

        doc.setTextColor(COLORS.textMuted[0], COLORS.textMuted[1], COLORS.textMuted[2])
        doc.text(materias[i].turma || '-', margin + colMat + 5, y + tableRowHeight / 2 + 2)
        doc.text(materias[i].subturma || '-', margin + colMat + colTurma + 5, y + tableRowHeight / 2 + 2)

        y += tableRowHeight
    }

    doc.save('horario-semanal.pdf')
}
