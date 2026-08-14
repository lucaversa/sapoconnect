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
