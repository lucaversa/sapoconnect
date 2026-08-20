export function normalizePersonName(value: unknown): string {
  if (typeof value !== "string") return ""

  const normalized = value.replace(/\s+/g, " ").trim()
  return normalized.replace(/\s+\.+$/g, "").trim()
}
