import { describe, expect, it } from "vitest"

import { normalizePersonName } from "@/lib/person-name"

describe("normalizePersonName", () => {
  it("removes extra whitespace and Moodle's trailing punctuation", () => {
    expect(normalizePersonName("  Pessoa   Sintetica Exemplo .  ")).toBe("Pessoa Sintetica Exemplo")
  })

  it("preserves periods that are part of the person's name", () => {
    expect(normalizePersonName("Maria P. Silva")).toBe("Maria P. Silva")
    expect(normalizePersonName("Maria Silva Jr.")).toBe("Maria Silva Jr.")
  })
})
