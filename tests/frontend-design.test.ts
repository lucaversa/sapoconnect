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

    expect(calendar).toContain('className="calendar-view-frame"')
    expect(agenda).toContain("calendar-scroll-viewport")
    expect(week).toContain('className="calendar-scroll-viewport"')
    expect(month).toContain('className="calendar-scroll-viewport"')
    expect(week).not.toContain("useMobileHorizontalScroll")
    expect(month).not.toContain("useMobileHorizontalScroll")
    expect(day).toContain('className="calendar-scroll-viewport"')
    expect(day).toContain('className="calendar-day-view"')
  })

  it("uses a compact mobile week grid and a bounded two-axis viewport", () => {
    const globals = read("app/globals.css")
    const week = read("components/event-calendar/week-view.tsx")
    const month = read("components/event-calendar/month-view.tsx")

    expect(globals).toContain(".calendar-view-frame")
    expect(globals).toContain(".calendar-scroll-viewport")
    expect(globals).toContain("height: min(55dvh, 32rem)")
    expect(globals).toContain("height: min(68dvh, 50rem)")
    expect(globals).toContain(".calendar-day-view > .calendar-scroll-viewport")
    expect(globals).toContain("touch-action: pan-x pan-y")
    expect(week).toContain("isCompactWeek ? 48 : WeekCellsHeight")
    expect(week).toContain("min-w-[720px] sm:min-w-[880px]")
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

  it("ends each absence risk timeline at its first red day", () => {
    const absences = read("app/app/faltas/page.tsx")

    expect(absences).toContain("findIndex((dia) => dia.acimaLimite && !dia.removido)")
    expect(absences).toContain("linhaTempo.slice(0, primeiroRiscoIndex + 1)")
    expect(absences).toContain("Risco em {format(primeiroDiaCritico.dia.date, 'dd/MM')}")
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

  it("places academic updates in the header and moves theme controls into the utility menu", () => {
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
    expect(mobileNav).toContain('className="grid grid-cols-4 gap-0.5"')
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
    expect(providers).toContain("<AcademicUpdatesProvider key={cacheScope}")
  })

  it("persists scoped update snapshots and limits background synchronization", () => {
    const provider = read("lib/academic-updates-provider.tsx")
    const storage = read("lib/storage.ts")

    expect(storage).toContain("const DB_VERSION = 5")
    expect(storage).toContain("const ACADEMIC_UPDATES_STORE = 'academic_updates'")
    expect(storage).toContain("store.put(payload, cacheScope)")
    expect(storage).toContain("stored.version === ACADEMIC_UPDATES_SCHEMA_VERSION")
    expect(storage).toContain("await clearAcademicUpdatesState(expectedScope)")
    expect(provider).toContain("BACKGROUND_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1_000")
    expect(provider).toContain("HISTORY_BACKGROUND_INTERVAL_MS = 24 * 60 * 60 * 1_000")
    expect(provider).toContain("await syncModule('calendario')")
    expect(provider).toContain("await syncModule(candidate)")
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
    expect(pulse).toContain("Dados anônimos")
    expect(pulse).not.toContain("COMMUNITY_PULSE_REVEAL_AT")
    expect(pulse).toContain("enabled,")
    expect(pulseDialog).toContain("<CommunityPulse enabled={open} showHeading={false} />")
    expect(pulseDialog).toContain("Nenhuma informação acadêmica")
    expect(route).toContain("s-maxage=21600")
    expect(route).toContain("stale-while-revalidate=86400")
    expect(featureTemplate).toContain("não contém RA, senha, notas")
    expect(bugTemplate).toContain("não contém RA, senha, notas")
  })

  it("shows the redesigned community announcement only once", () => {
    const layout = read("app/app/layout.tsx")
    const announcement = read("components/modals/CommunityLaunchDialog.tsx")
    const orbit = read("components/brand/BrandOrbit.tsx")
    const login = read("app/login/page.tsx")

    expect(layout).toContain("<CommunityLaunchDialog />")
    expect(announcement).toContain("sapoconnect:announcement:community-pulse-2026-08")
    expect(announcement).toContain("2026-08-28T18:00:00-03:00")
    expect(announcement).toContain("remainingTime <= 0")
    expect(announcement).toContain("O SapoConnect está sendo muito visitado")
    expect(announcement).toContain("As funções continuam as mesmas")
    expect(announcement).toContain("Nova área: Pulso da comunidade")
    expect(orbit).toContain('data-community-orbit="outer"')
    expect(orbit).toContain('data-community-orbit="inner"')
    expect(orbit).toContain("icon={CalendarDays}")
    expect(orbit).toContain("icon={GraduationCap}")
    expect(orbit).not.toContain("absolute -right-1 -top-1 size-3 rounded-full")
    expect(announcement).toContain("<BrandOrbit priority />")
    expect(login).toContain("<BrandOrbit compact priority />")
    expect(announcement).toContain("navigator.share")
    expect(announcement).toContain("navigator.clipboard.writeText")
    expect(announcement).toContain("Compartilhar com outros alunos")
    expect(announcement).toContain('aria-label="Fechar aviso"')
    expect(announcement).toContain("🔝")
    expect(announcement).not.toContain("XIcon")
  })

  it("targets the recurring Lite upgrade notice through the private server session", () => {
    const layout = read("app/app/layout.tsx")
    const banner = read("components/modals/LiteUpgradeBanner.tsx")
    const manager = read("lib/session-manager.ts")
    const sessionRoute = read("app/api/auth/session/route.ts")
    const refreshRoute = read("app/api/auth/refresh/route.ts")
    const env = read(".env.example")

    expect(layout).toContain("<LiteUpgradeBanner />")
    expect(banner).toContain("LITE_BANNER_INTERVAL_MS = 2 * 60 * 1_000")
    expect(banner).toContain("CLOSE_DELAY_SECONDS = 10")
    expect(banner).toContain('user?.appTier === "lite"')
    expect(banner).toContain("SapoConnect Lite")
    expect(banner).toContain("R$ 100")
    expect(banner).toContain("35997030903")
    expect(banner).toContain("Continuar no Lite")
    expect(banner).toContain("onPointerDownOutside")
    expect(manager).toContain("appTier")
    expect(sessionRoute).toContain("resolveAppTier(session.ra)")
    expect(refreshRoute).toContain("resolveAppTier(session.ra)")
    expect(env).toContain("SAPOCONNECT_LITE_RAS=")
    expect(env).not.toContain("NEXT_PUBLIC_SAPOCONNECT_LITE_RAS")
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

  it("renders the absence risk projection as an aligned timeline", () => {
    const absences = read("app/app/faltas/page.tsx")

    expect(absences).toContain("Projeção por data")
    expect(absences).toContain('aria-label="Linha do tempo da projeção de faltas"')
    expect(absences).toContain("absolute inset-x-1 top-0 h-0.5 rounded-full")
    expect(absences).not.toContain("shrink-0 border-t-2")
  })
})
