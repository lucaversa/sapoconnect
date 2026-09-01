import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")

describe("frontend information architecture", () => {
  it("does not use editorial eyebrow labels on academic pages", () => {
    const pages = [
      "app/app/calendario/page.tsx",
      "app/app/avaliacoes/page.tsx",
      "app/app/faltas/page.tsx",
      "app/app/historico/page.tsx",
      "app/app/ava/page.tsx",
      "app/app/ava/[courseId]/page.tsx",
    ].map(read).join("\n")

    expect(pages).not.toContain("Grade inteligente")
    expect(pages).not.toContain("Performance acadêmica")
    expect(pages).not.toContain("Radar de frequência")
    expect(pages).not.toContain("Jornada acadêmica")
    expect(pages).not.toContain("Sua semana acadêmica com aulas")
    expect(pages).not.toContain("Entenda sua margem de segurança")
    expect(pages).not.toContain("Notas, lançamentos e médias organizados")
    expect(pages).not.toContain("Sua evolução por período")
  })

  it("keeps an explicit time axis in week and day schedules", () => {
    const week = read("components/event-calendar/week-view.tsx")
    const day = read("components/event-calendar/day-view.tsx")

    expect(week).toContain("data-time-axis")
    expect(day).toContain("data-time-axis")
    expect(week).toContain('data-time-axis className="sticky left-0 z-30 relative')
    expect(day).toContain('data-time-axis className="sticky left-0 z-30 relative')
    expect(week).toContain('className="pointer-events-none absolute inset-x-0 z-20 border-t border-primary"')
    expect(day).toContain('className="pointer-events-none absolute inset-x-0 z-20 border-t border-primary"')
  })

  it("keeps every calendar view inside the same scrollable frame", () => {
    const calendar = read("components/event-calendar/event-calendar.tsx")
    const agenda = read("components/event-calendar/agenda-view.tsx")
    const week = read("components/event-calendar/week-view.tsx")
    const month = read("components/event-calendar/month-view.tsx")
    const day = read("components/event-calendar/day-view.tsx")

    expect(calendar).toContain('cn("calendar-view-frame", view !== "agenda" && "calendar-page-scroll-frame")')
    expect(agenda).toContain("calendar-scroll-viewport")
    expect(week).toContain('className="calendar-scroll-viewport"')
    expect(month).toContain("calendar-scroll-viewport")
    expect(week).not.toContain("useMobileHorizontalScroll")
    expect(month).not.toContain("useMobileHorizontalScroll")
    expect(day).toContain('className="calendar-scroll-viewport"')
    expect(day).toContain('className="calendar-day-view"')
  })

  it("uses a compact mobile week grid with page-owned vertical scrolling", () => {
    const globals = read("app/globals.css")
    const calendar = read("components/event-calendar/event-calendar.tsx")
    const constants = read("components/event-calendar/constants.ts")
    const week = read("components/event-calendar/week-view.tsx")
    const month = read("components/event-calendar/month-view.tsx")
    const day = read("components/event-calendar/day-view.tsx")
    const compactHook = read("components/event-calendar/hooks/use-compact-calendar.ts")

    expect(globals).toContain(".calendar-view-frame")
    expect(globals).toContain(".calendar-scroll-viewport")
    expect(globals).toContain("height: min(55dvh, 32rem)")
    expect(globals).toContain("height: min(68dvh, 50rem)")
    expect(globals).toContain(".calendar-day-view > .calendar-scroll-viewport")
    expect(globals).toContain("touch-action: pan-x pan-y")
    expect(week).toContain("compact ? 40 : WeekCellsHeight")
    expect(week).toContain("min-w-[460px] sm:min-w-[880px]")
    expect(constants).toContain('WeekdayLabels = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"]')
    expect(week).toContain("WeekdayLabels[day.getDay()]")
    expect(week.match(/grid-cols-\[2\.5rem_repeat\(7,minmax\(0,1fr\)\)\]/g)).toHaveLength(3)
    expect(week).toContain("absolute inset-x-0.5 z-10 sm:inset-x-1")
    expect(month).toContain('className="calendar-scroll-viewport calendar-month-view"')
    expect(month).toContain("w-full sm:min-w-[720px]")
    expect(month).toContain("WeekdayLabels[day.getDay()]")
    expect(day).toContain("compact ? 40 : DayCellsHeight")
    expect(day).toContain("hourHeight })")
    expect(week).toContain("useCompactCalendar()")
    expect(day).toContain("useCompactCalendar()")
    expect(compactHook).toContain('(max-width: 639px)')
    expect(compactHook).toContain("useSyncExternalStore")
    expect(compactHook).toContain("getCompactCalendarSnapshot")
    expect(compactHook).toContain("() => true")
    expect(calendar).toContain('view !== "agenda" && "calendar-page-scroll-frame"')
    expect(globals).toContain(".calendar-page-scroll-frame .calendar-scroll-viewport")
    expect(globals).toContain(".calendar-page-scroll-frame .calendar-day-view > .calendar-scroll-viewport")
    expect(globals).toContain(".calendar-page-scroll-frame .calendar-month-view")
    expect(globals).toContain("overflow-y: clip")
    expect(globals).toContain("overscroll-behavior-y: auto")
    expect(month).toContain("min-h-24")
  })

  it("keeps agenda cards inside the mobile viewport", () => {
    const agenda = read("components/event-calendar/agenda-view.tsx")
    const eventItem = read("components/event-calendar/event-item.tsx")

    expect(agenda).toContain("grid-cols-[minmax(0,1fr)]")
    expect(agenda).toContain("min-w-0 max-w-full")
    expect(eventItem).toContain("w-full max-w-full")
    expect(eventItem).toContain("[overflow-wrap:anywhere]")
  })

  it("opens a selected month day in the daily view without hijacking event buttons", () => {
    const calendar = read("components/event-calendar/event-calendar.tsx")
    const month = read("components/event-calendar/month-view.tsx")

    expect(calendar).toContain("const selectDay = (day: Date)")
    expect(calendar).toContain('setSelectedView("day")')
    expect(calendar).toContain("onDaySelect={selectDay}")
    expect(month).toContain("onDaySelect: (day: Date) => void")
    expect(month).toContain('data-month-day={format(day, "yyyy-MM-dd")}')
    expect(month).toContain("onClick={() => onDaySelect(day)}")
    expect(month).toContain("na visão diária")
    expect(month).toContain("pointer-events-none relative z-10")
    expect(month).toContain("pointer-events-auto h-6")
  })

  it("keeps academic modules separated and removes the old nested score card", () => {
    const evaluations = read("app/app/avaliacoes/page.tsx")
    expect(evaluations).toContain('className="academic-stack"')
    expect(evaluations).toContain("<AcademicPanel")
    expect(evaluations).not.toContain("Somatório das notas lançadas")
  })

  it("does not expose the desktop sidebar below the desktop breakpoint", () => {
    const sidebar = read("components/layout/AppSidebar.tsx")
    expect(sidebar).toContain("hidden w-72 flex-col")
    expect(sidebar).toContain("lg:flex")
  })

  it("keeps long calendar summaries full-width on phones", () => {
    const calendar = read("app/app/calendario/page.tsx")
    expect(calendar).toContain('className="grid grid-cols-1 gap-3 sm:grid-cols-2"')
    expect(calendar).not.toContain("min-[390px]:grid-cols-2")
  })

  it("uses compact full-width metrics and pull-to-refresh guidance on phones", () => {
    const evaluations = read("app/app/avaliacoes/page.tsx")
    const pullToRefresh = read("components/pull-to-refresh.tsx")

    expect(evaluations).toContain('grid grid-cols-1 gap-2.5 sm:grid-cols-3')
    expect(evaluations).toContain("<MetricCard compact")
    expect(pullToRefresh).toContain("Puxe para baixo para atualizar")
    expect(pullToRefresh).toContain("PULL_HINT_SEEN_KEY")
    expect(pullToRefresh).toContain("PULL_HINT_DURATION_MS = 4_000")
    expect(pullToRefresh).toContain("PULL_GESTURE_BLOCK_SELECTOR")
    expect(pullToRefresh).toContain("'[data-pull-to-refresh-ignore], [data-calendar-scroll], [data-slot=\"dialog-content\"], [role=\"dialog\"]'")
    expect(pullToRefresh).toContain("document.querySelector(OPEN_DIALOG_SELECTOR)")
    expect(pullToRefresh).toContain("isPullGestureBlocked(event.target)")
    expect(pullToRefresh).toContain("pullDistance > 0 && !isRefreshing")
    expect(pullToRefresh).toContain("DEFAULT_PULL_DISTANCE = 96")
    expect(pullToRefresh).toContain("PULL_ACTIVATION_DISTANCE = 18")
    expect(pullToRefresh).toContain("PULL_RESISTANCE = 0.72")
    expect(pullToRefresh).toContain("VERTICAL_INTENT_RATIO = 1.35")
    expect(pullToRefresh).toContain("'touchcancel', onTouchCancel")
    expect(pullToRefresh).not.toContain("'touchcancel', onTouchEnd")
    expect(pullToRefresh).not.toContain("isRefreshing\n    ? 'Atualizando...'")
  })

  it("uses an aligned 2x2 tile grid for absence metrics on phones", () => {
    const absences = read("app/app/faltas/page.tsx")
    const metricCard = read("components/ui/metric-card.tsx")

    expect(absences).toContain('className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4"')
    expect(absences.match(/<MetricCard tile/g)).toHaveLength(4)
    expect(metricCard).toContain('tile ? "p-3 sm:p-4"')
    expect(metricCard).toContain('min-h-[6.5rem] flex-col justify-between')
  })

  it("keeps pull-to-refresh behind the scrollable about dialog", () => {
    const aboutDialog = read("components/modals/AboutDialog.tsx")
    const pullToRefresh = read("components/pull-to-refresh.tsx")

    expect(aboutDialog).toContain("<DialogContent data-pull-to-refresh-ignore")
    expect(pullToRefresh).toContain("OPEN_DIALOG_SELECTOR")
    expect(pullToRefresh).toContain("resetPullGesture()")
  })

  it("ends each absence risk projection at its first critical date", () => {
    const absences = read("app/app/faltas/page.tsx")

    expect(absences).toContain("getLinhaTempoRisco")
    expect(absences).toContain("findIndex((dia) => dia.aboveLimit && !dia.removed)")
    expect(absences).toContain("linhaTempo.slice(0, primeiroRiscoIndex + 1)")
  })

  it("makes weekday absence groups independently collapsible", () => {
    const absences = read("app/app/faltas/page.tsx")

    expect(absences).toContain("expandedDiasSemana")
    expect(absences).toContain("toggleGrupoDiaSemana(item.codigo, grupo.key)")
    expect(absences).toContain("aria-expanded={grupoExpanded}")
    expect(absences).toContain("aria-controls={grupoPanelId}")
    expect(absences).toContain("{grupoExpanded ? (")
    expect(absences).toContain("detail-reveal mt-3")
  })

  it("keeps absence subjects collapsed by default with a decision-focused summary", () => {
    const absences = read("app/app/faltas/page.tsx")

    expect(absences).toContain("expandedDisciplinas")
    expect(absences).toContain("useState<Set<string>>(new Set())")
    expect(absences).toContain("toggleDisciplina(item.codigo)")
    expect(absences).toContain("data-absence-summary")
    expect(absences).toContain("aria-expanded={disciplinaExpanded}")
    expect(absences).toContain("aria-controls={disciplinaPanelId}")
    expect(absences).toContain("{item.disciplina}")
    expect(absences).toContain("{statusConfig.label}")
    expect(absences).toContain("{item.porcentagem}")
    expect(absences).toContain("</span> de {item.limiteFaltas}")
    expect(absences).toContain("{disciplinaExpanded ? (")
    expect(absences).toContain('id={disciplinaPanelId} className="detail-reveal')
  })

  it("loads absence dates when the subject opens and renders them as a section", () => {
    const absences = read("app/app/faltas/page.tsx")
    const disclosure = read("components/faltas/datas-falta-disclosure.tsx")
    const hook = read("hooks/use-faltas.ts")

    expect(absences).toContain("<DatasFaltaSection")
    expect(disclosure).toContain("data-absence-history")
    expect(disclosure).toContain("Dias em que faltei")
    expect(disclosure).toContain("useDatasFalta(codigo, true)")
    expect(disclosure).toContain("aria-busy={isFetching}")
    expect(disclosure).toContain('<time')
    expect(disclosure).not.toContain("prazo de até 15 dias após a aula")
    expect(disclosure).toContain("error && data")
    expect(disclosure).toContain("Não foi possível atualizar agora. Exibindo a última consulta salva.")
    expect(hook).toContain("useDatasFalta(codigo: string, enabled: boolean)")
    expect(hook).toContain("{ enabled, staleTime: QUERY_STALE_TIME.faltas }")
  })

  it("separates current absence status, consultation, and future simulation", () => {
    const absences = read("app/app/faltas/page.tsx")

    expect(absences).toContain("Cada falta de 50 minutos equivale")
    expect(absences).toContain("Simulação de faltas futuras")
    expect(absences).toContain("sem alterar seus registros reais")
    expect(absences).toContain("divide-y divide-gray-200/75")
    expect(absences).toContain('className="py-4 sm:py-5"')
    expect(absences).toContain("Aulas consideradas na simulação")
    expect(absences).toContain('role="switch"')
    expect(absences).toContain("aria-checked={!grupoTodoRemovido}")
    expect(absences).toContain("aria-checked={!removido}")
    expect(absences).not.toContain("Remover {grupo.label}")
    expect(absences).not.toContain("Remover dia")
  })

  it("renders the absence risk projection as one cohesive responsive component", () => {
    const absences = read("app/app/faltas/page.tsx")
    const projection = read("components/faltas/frequency-risk-projection.tsx")

    expect(absences).toContain("<FrequencyRiskProjection")
    expect(projection).toContain("data-risk-projection")
    expect(projection).toContain("Projeção por data")
    expect(projection).toContain("Limite ultrapassado em")
    expect(projection).toContain("Dentro do limite nas aulas simuladas")
    expect(projection).toContain('role="region"')
    expect(projection).toContain("sm:w-full sm:min-w-0")
    expect(projection).toContain("Percentual acumulado ao faltar nas aulas incluídas")
    expect(projection).toContain("acima do limite")
    expect(projection).toContain("não incluído")
    expect(projection).not.toContain("Risco em")
  })

  it("uses one Liquid Glass system for mobile navigation and feedback", () => {
    const globals = read("app/globals.css")
    const sidebar = read("components/layout/AppSidebar.tsx")
    const header = read("components/layout/AppHeader.tsx")
    const pullToRefresh = read("components/pull-to-refresh.tsx")
    const offlineBanner = read("components/totvs-offline-banner.tsx")
    const toaster = read("components/app-toaster.tsx")

    expect(globals).toContain(".liquid-float")
    expect(globals).toContain("backdrop-filter: blur(28px) saturate(185%) contrast(1.04)")
    expect(globals).toContain("@media (prefers-reduced-transparency: reduce)")
    expect(globals).toContain("@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px)))")
    expect(sidebar).toContain("liquid-float liquid-dock")
    expect(sidebar).toContain('layoutId="mobile-nav-active"')
    expect(header).toContain("liquid-float absolute right-4")
    expect(pullToRefresh).toContain("liquid-float liquid-notice")
    expect(offlineBanner).toContain("liquid-float liquid-notice liquid-notice-warning")
    expect(toaster).toContain("toast: 'liquid-float liquid-toast'")
    expect(toaster).toContain("mobileOffset")
    expect(toaster).toContain("style={{ zIndex: 35 }}")
  })

  it("keeps utilities in the header menu and the sidebar focused on academic navigation", () => {
    const header = read("components/layout/AppHeader.tsx")
    const mobileNav = read("components/layout/AppSidebar.tsx")

    expect(header).toContain('href="/app/atualizacoes"')
    expect(header).toContain("unreadCount > 99 ? \"99+\" : unreadCount")
    expect(header).toContain('aria-controls="utility-menu"')
    expect(header).toContain('theme === "dark" ? "Usar tema claro" : "Usar tema escuro"')
    expect(header).toContain("toggleTheme(); closeUtilityMenu()")
    expect(header).toContain("Pulso da comunidade")
    expect(header).toContain("setIsCommunityPulseOpen(true)")
    expect(header).toContain("Criado e mantido por")
    expect(header).toContain("Luca Janini")
    expect(header.indexOf("Sobre e instalar")).toBeLessThan(header.indexOf("Portal oficial"))
    expect(mobileNav).not.toContain("Sobre e instalar")
    expect(mobileNav).not.toContain("Portal oficial")
    expect(mobileNav).not.toContain("Conta acadêmica")
    expect(mobileNav).toContain('className="grid grid-cols-5 gap-0.5"')
    expect(mobileNav).toContain('href: "/app/ava"')
    expect(mobileNav).not.toContain('/app/atualizacoes')
    expect(mobileNav).toContain('mobile-dock-viewport')
    expect(mobileNav).toContain('data-mobile-dock')
  })

  it("shows a Liquid Glass update feed with detail and safe module navigation", () => {
    const page = read("app/app/atualizacoes/page.tsx")
    const detail = read("components/updates/UpdateDetailDialog.tsx")
    const providers = read("app/app/providers.tsx")

    expect(page).toContain('title="Atualizações"')
    expect(page).toContain("liquid-float")
    expect(page).toContain("Não lidas")
    expect(page).not.toContain('Verificar atualizações agora')
    expect(page).not.toContain('handleSync')
    expect(page).toContain('Marcar todas as atualizações como lidas')
    expect(page).toContain('Ler tudo')
    expect(page).toContain('const readAllAndReturn = () => {')
    expect(page).toContain('markAllRead()')
    expect(page).toContain('router.back()')
    expect(page).not.toContain('Nenhuma pendência')
    expect(page).not.toContain('Nenhuma alteração detectada')
    expect(page).not.toContain('O primeiro retrato de cada módulo')
    expect(page).toContain('Nenhuma atualização por enquanto')
    expect(page).toContain('Quando seus dados acadêmicos mudarem, os detalhes aparecerão aqui.')
    expect(page).toContain('flex items-center gap-2 rounded-[1.5rem]')
    expect(page).toContain("const UPDATES_PAGE_SIZE = 20")
    expect(page).toContain("filteredUpdates.slice(0, visibleLimit)")
    expect(page).toContain("Mostrar mais")
    expect(page).toContain("markRead(update.id)")
    expect(detail).toContain("Antes")
    expect(detail).toContain("Agora")
    expect(detail).toContain("Informações completas")
    expect(detail).toContain('className="gap-0 p-0 sm:max-w-xl sm:p-0"')
    expect(detail).toContain('pl-5 pr-20')
    expect(detail).toContain('overscroll-contain px-5 sm:px-6')
    expect(detail).toContain('px-5 pb-5 pt-4 sm:px-6')
    expect(detail).toContain('data-update-summary')
    expect(detail).toContain('data-update-action')
    expect(detail).not.toContain('truncate text-xs text-gray-500')
    expect(detail).toContain("prefetch={false}")
    expect(detail).toContain("Abrir {moduleMeta.label}")
    expect(providers).toContain("<AvaIntegrationProvider key={cacheScope}")
    expect(providers).toContain("<AcademicUpdatesProvider cacheScope={cacheScope}")
  })

  it("keeps Moodle authentication explicit and separate from the TOTVS login", () => {
    const modal = read("components/modals/AvaConnectionDialog.tsx")
    const header = read("components/layout/AppHeader.tsx")
    const provider = read("lib/ava-integration-provider.tsx")

    expect(modal).toContain("A senha do AVA pode ser diferente")
    expect(modal).toContain("usada uma única vez")
    expect(modal).toContain('autoComplete="current-password"')
    expect(modal).not.toContain("senha do EduConnect")
    expect(header).toContain("Conectar ao AVA")
    expect(header).toContain("normalizePersonName(userName)")
    expect(header).toContain('`${salutation}, ${normalizedUserName}`')
    expect(header).toContain("connection.connected ? connection.fullName : null")
    expect(provider).toContain("maxRetries: 0")
  })

  it("shows current AVA courses, pending work, section materials and protected downloads", () => {
    const overview = read("app/app/ava/page.tsx")
    const detail = read("app/app/ava/[courseId]/page.tsx")
    const calendar = read("app/app/calendario/page.tsx")
    const download = read("app/api/moodle/files/route.ts")
    const contentSummary = read("app/api/moodle/content-summary/route.ts")
    const overviewRoute = read("app/api/moodle/overview/route.ts")
    const courseRoute = read("app/api/moodle/courses/[courseId]/route.ts")

    expect(overview).toContain('label="Próxima tarefa"')
    expect(overview).toContain('label="Tarefas pendentes"')
    expect(overview).toContain("formatDistanceToNow")
    expect(overview).toContain("Atualizado {lastUpdatedLabel}")
    expect(detail).toContain("Conteúdos por seção")
    expect(detail).toContain("Atividades pendentes")
    expect(detail).toContain("material.downloadUrl")
    expect(detail).toContain('aria-label="Arquivo PDF"')
    expect(detail).toContain("MATERIAL_ICON_STYLES[materialKind]")
    expect(detail).not.toContain("pdf: FileText")
    expect(overview).toContain("useAvaContentSummary")
    expect(overview).toContain("sectionCount")
    expect(overview).toContain("materialCount")
    expect(calendar).toContain("avaTasksToCalendarEvents")
    expect(download).toContain("requireMoodleConnection")
    expect(download).toContain("X-Content-Type-Options")
    expect(contentSummary).toContain("getMoodleContentSummary")
    expect(contentSummary).toContain("MAX_COURSES_PER_REQUEST")
    for (const route of [overviewRoute, contentSummary, courseRoute, download]) {
      expect(route).toContain("renewMoodleSession(moodleSession)")
    }
  })

  it("persists scoped update snapshots and limits background synchronization", () => {
    const provider = read("lib/academic-updates-provider.tsx")
    const schedule = read("lib/academic-update-schedule.ts")
    const batch = read("lib/evaluation-update-batch.ts")
    const storage = read("lib/storage.ts")

    expect(storage).toContain("const DB_VERSION = 5")
    expect(storage).toContain("const ACADEMIC_UPDATES_STORE = 'academic_updates'")
    expect(storage).toContain("store.put(payload, cacheScope)")
    expect(storage).toContain("stored.version === ACADEMIC_UPDATES_SCHEMA_VERSION")
    expect(storage).toContain("await clearAcademicUpdatesState(expectedScope)")
    expect(schedule).toContain("ABSENCES_BACKGROUND_INTERVAL_MS = 4 * 60 * 60 * 1_000")
    expect(schedule).toContain("EVALUATIONS_BACKGROUND_INTERVAL_MS = 6 * 60 * 60 * 1_000")
    expect(schedule).toContain("EVALUATIONS_FULL_INTERVAL_MS = 24 * 60 * 60 * 1_000")
    expect(batch).toContain("EVALUATION_BACKGROUND_BATCH_SIZE = 3")
    expect(provider).toContain("apiFetch('/api/faltas')")
    expect(provider).toContain("apiFetch('/api/avaliacoes/atualizacoes'")
    expect(provider).toContain("acquireBackgroundLock")
    expect(provider).toContain("document.visibilityState !== 'visible'")
    expect(provider).not.toContain('syncAll')
    expect(provider).not.toContain("mode: 'manual'")
  })

  it("hides manual refresh actions below the desktop breakpoint", () => {
    const pages = [
      "app/app/calendario/page.tsx",
      "app/app/avaliacoes/page.tsx",
      "app/app/faltas/page.tsx",
      "app/app/historico/page.tsx",
    ].map(read)

    for (const page of pages) {
      expect(page).toContain('aria-label="Atualizar" className="hidden sm:inline-flex"')
    }

    for (const page of pages.slice(1)) {
      expect(page).toContain("desktopActionsOnly")
    }
  })

  it("does not duplicate the close action in the class details modal", () => {
    const dialog = read("components/event-calendar/event-view-dialog.tsx")
    expect(dialog).not.toContain(">Fechar</Button>")
  })

  it("describes the login as an optimized academic portal", () => {
    expect(read("app/login/page.tsx")).toContain("portal acadêmico otimizado")
  })

  it("collects anonymous page views from the root layout", () => {
    const layout = read("app/layout.tsx")

    expect(layout).toContain('import { Analytics } from "@vercel/analytics/next"')
    expect(layout).toContain("<Analytics />")
  })

  it("exposes an anonymous community pulse and GitHub feedback paths", () => {
    const about = read("components/modals/AboutDialog.tsx")
    const pulse = read("components/community/CommunityPulse.tsx")
    const pulseDialog = read("components/modals/CommunityPulseDialog.tsx")
    const route = read("app/api/community/pulse/route.ts")
    const featureTemplate = read(".github/ISSUE_TEMPLATE/feature_request.yml")
    const bugTemplate = read(".github/ISSUE_TEMPLATE/bug_report.yml")

    expect(about).not.toContain("<CommunityPulse")
    expect(about).toContain("Criado e mantido por")
    expect(about).toContain("Luca Janini")
    expect(about).toContain("feature_request.yml")
    expect(about).toContain("bug_report.yml")
    expect(pulse).toContain("grid grid-cols-2")
    expect(pulse).toContain('label="Alunos hoje" value={data.todayVisitors} zeroAsDash')
    expect(pulse).toContain('<span aria-hidden="true">-</span>')
    expect(pulse).toContain('<span className="sr-only">Sem registro</span>')
    expect(pulse).toContain("Dados anônimos")
    expect(pulse).toContain("Dados anônimos do uso do aplicativo.")
    expect(pulse).not.toContain("atualizados às 00h")
    expect(pulse).toContain("Criado e mantido por")
    expect(pulse).toContain("Luca Janini")
    expect(pulse).not.toContain("COMMUNITY_PULSE_REVEAL_AT")
    expect(pulse).toContain("enabled,")
    expect(pulse).toContain("schedule.cacheKey")
    expect(pulseDialog).toContain("<CommunityPulse enabled={open} showHeading={false} />")
    expect(pulseDialog).not.toContain("Atualizado às 00h")
    expect(pulseDialog).toContain("Nenhuma informação acadêmica")
    expect(route).toContain("secondsUntilNextRefresh")
    expect(route).toContain("stale-while-revalidate=300")
    expect(featureTemplate).toContain("não contém RA, senha, notas")
    expect(bugTemplate).toContain("não contém RA, senha, notas")
  })

  it("shows the AVA launch announcement once during its 15-day window", () => {
    const layout = read("app/app/layout.tsx")
    const announcement = read("components/modals/AvaLaunchDialog.tsx")
    const onboarding = read("lib/onboarding.ts")

    expect(layout).toContain("<AvaLaunchDialog />")
    expect(layout).not.toContain("<CommunityLaunchDialog />")
    expect(onboarding).toContain("sapoconnect:announcement:ava-2026-08")
    expect(onboarding).toContain("2026-08-20T00:00:00-03:00")
    expect(onboarding).toContain("2026-09-04T00:00:00-03:00")
    expect(announcement).toContain("isAvaAnnouncementActive")
    expect(announcement).toContain("wasFirstLoginGuideSeen")
    expect(announcement).toContain("FIRST_LOGIN_GUIDE_COMPLETED_EVENT")
    expect(announcement).toContain("rememberAvaAnnouncement")
    expect(announcement).toContain("Novo módulo AVA")
    expect(announcement).toContain('title: "Disciplinas"')
    expect(announcement).toContain('title: "Materiais"')
    expect(announcement).toContain('title: "Tarefas e prazos"')
    expect(announcement).not.toContain("Explorar o AVA")
    expect(announcement).toContain('aria-label="Fechar aviso"')
    expect(announcement).toContain("🔝")
    expect(announcement).not.toContain("XIcon")
  })

  it("introduces theme and app installation on the first login", () => {
    const layout = read("app/app/layout.tsx")
    const guide = read("components/modals/FirstLoginGuideDialog.tsx")
    const onboarding = read("lib/onboarding.ts")

    expect(layout).toContain("<FirstLoginGuideDialog />")
    expect(layout.indexOf("<FirstLoginGuideDialog />")).toBeLessThan(
      layout.indexOf("<AvaLaunchDialog />"),
    )
    expect(guide).toContain("user?.ra")
    expect(guide).toContain("Modos claro e escuro")
    expect(guide).toContain('aria-pressed={theme === "light"}')
    expect(guide).toContain('aria-pressed={theme === "dark"}')
    expect(guide).toContain("Adicionar à Tela de Início")
    expect(guide).toContain("Instalar app")
    expect(guide).toContain("Começar")
    expect(guide).toContain("useReducedMotion")
    expect(guide).toContain("rememberFirstLoginGuide")
    expect(guide).toContain("FIRST_LOGIN_GUIDE_COMPLETED_EVENT")
    expect(guide).not.toContain("rememberAvaAnnouncement")
    expect(onboarding).toContain("SHA-256")
    expect(onboarding).toContain("getOrCreateDeviceId")
  })

  it("does not leave a module in an endless loader when offline cache is missing", () => {
    const pages = [
      "app/app/calendario/page.tsx",
      "app/app/avaliacoes/page.tsx",
      "app/app/faltas/page.tsx",
      "app/app/historico/page.tsx",
    ].map(read)

    for (const page of pages) {
      expect(page).toContain("fetchStatus")
      expect(page).toContain("Sem dados salvos")
    }
  })

  it("keeps the AVA route and connection state available offline", () => {
    const serviceWorker = read("public/sw.js")
    const provider = read("lib/ava-integration-provider.tsx")
    const overview = read("app/app/ava/page.tsx")
    const detail = read("app/app/ava/[courseId]/page.tsx")
    const persistence = read("lib/query-persist.ts")

    expect(serviceWorker).toContain("sapoconnect-shell-v4")
    expect(serviceWorker).toContain("'/app/ava'")
    expect(serviceWorker).toContain("url.pathname.startsWith('/app/ava') ? '/app/ava' : '/app'")
    expect(persistence).toContain("'ava-connection'")
    expect(provider).toContain("connectionQuery.fetchStatus === 'paused'")
    expect(provider).toContain("connectionQuery.isError")
    expect(overview).toContain("isConnectionUnavailable")
    expect(detail).toContain("isConnectionUnavailable")
    expect(overview).toContain("Sua integração continua salva")
    expect(detail).toContain("Sua integração continua salva")
  })

  it("excludes equivalent subjects from every history count", () => {
    const history = read("app/app/historico/page.tsx")

    expect(history).toContain("calculateHistoryCounts(periodos)")
    expect(history).toContain("getCountedHistorySubjects(periodo.disciplinas)")
    expect(history).toContain("getCountedHistorySubjects(bloco.disciplinas)")
    expect(history).toContain("{disciplinasContabilizadasNoBloco.length} disciplinas")
    expect(history).not.toContain("{bloco.disciplinas.length} disciplinas")
    expect(history).toContain("label: 'Equivalente'")
    expect(history).toContain("const disciplinasContabilizadasNoPeriodo")
    expect(history).toContain("{totalDisciplinasNoPeriodo} disciplinas")
    expect(history).toContain("concluidasNoPeriodo === totalDisciplinasNoPeriodo")
  })

  it("matches module heading icons to navigation", () => {
    const evaluations = read("app/app/avaliacoes/page.tsx")
    const history = read("app/app/historico/page.tsx")
    const absences = read("app/app/faltas/page.tsx")

    expect(evaluations).toContain('icon={Star}')
    expect(history).toContain('icon={History}')
    expect(absences).toContain('icon={ClipboardList}')
  })

  it("animates every data progress bar with reduced-motion support", () => {
    const animatedProgress = read("components/ui/animated-progress.tsx")
    const metricCard = read("components/ui/metric-card.tsx")
    const evaluations = read("app/app/avaliacoes/page.tsx")
    const absences = read("app/app/faltas/page.tsx")
    const history = read("app/app/historico/page.tsx")

    expect(animatedProgress).toContain("useReducedMotion")
    expect(animatedProgress).toContain("scaleX")
    expect(animatedProgress).toContain("origin-left")
    expect(animatedProgress).toContain("whileInView")
    expect(animatedProgress).toContain("viewport={PROGRESS_VIEWPORT}")
    expect(animatedProgress).toContain("once: true")
    expect(animatedProgress).toContain('role="progressbar"')
    expect(metricCard.match(/<AnimatedProgress/g)).toHaveLength(2)
    expect(evaluations).toContain("<AnimatedSegmentedProgress")
    expect(absences).toContain("<AnimatedProgress")
    expect(history).toContain("<AnimatedProgress")

    for (const source of [metricCard, evaluations, absences, history]) {
      expect(source).not.toContain("transition-[width]")
      expect(source).not.toContain("animate={{ width")
    }
  })

})
