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
    expect(read("components/event-calendar/week-view.tsx")).toContain("data-time-axis")
    expect(read("components/event-calendar/day-view.tsx")).toContain("data-time-axis")
  })

  it("lets mobile pages scroll vertically from every calendar view", () => {
    const week = read("components/event-calendar/week-view.tsx")
    const month = read("components/event-calendar/month-view.tsx")
    const day = read("components/event-calendar/day-view.tsx")

    expect(week).toContain('className="calendar-scroll-viewport"')
    expect(month).toContain('className="calendar-scroll-viewport"')
    expect(week).not.toContain("useMobileHorizontalScroll")
    expect(month).not.toContain("useMobileHorizontalScroll")
    expect(day).toContain('className="calendar-scroll-viewport"')
  })

  it("uses a compact mobile week grid and a bounded two-axis viewport", () => {
    const globals = read("app/globals.css")
    const week = read("components/event-calendar/week-view.tsx")
    const month = read("components/event-calendar/month-view.tsx")

    expect(globals).toContain(".calendar-scroll-viewport")
    expect(globals).toContain("height: min(55dvh, 32rem)")
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
    expect(pullToRefresh).toContain("closest('[data-calendar-scroll]')")
  })

  it("uses an aligned 2x2 tile grid for absence metrics on phones", () => {
    const absences = read("app/app/faltas/page.tsx")
    const metricCard = read("components/ui/metric-card.tsx")

    expect(absences).toContain('className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4"')
    expect(absences.match(/<MetricCard tile/g)).toHaveLength(4)
    expect(metricCard).toContain('tile ? "p-3 sm:p-4"')
    expect(metricCard).toContain('min-h-[6.5rem] flex-col justify-between')
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
})
