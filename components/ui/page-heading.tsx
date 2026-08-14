import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

export function PageHeading({
  icon: Icon,
  title,
  description,
  meta,
  actions,
  desktopActionsOnly = false,
}: {
  icon: LucideIcon
  title: string
  description?: string
  meta?: ReactNode
  actions?: ReactNode
  desktopActionsOnly?: boolean
}) {
  return (
    <header className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <Icon className="size-5 text-primary" aria-hidden="true" />
          <h1 className="text-[1.85rem] font-extrabold leading-[1.05] tracking-[-0.055em] text-gray-950 dark:text-white sm:text-[2.35rem]">{title}</h1>
        </div>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">{description}</p> : null}
        {meta ? <div className={description ? "mt-2 text-xs text-gray-500 dark:text-gray-400" : "mt-1.5 text-xs text-gray-500 dark:text-gray-400"}>{meta}</div> : null}
      </div>
      {actions ? (
        <div className={desktopActionsOnly ? "hidden items-center gap-2 sm:flex sm:w-auto" : "flex w-full items-center gap-2 sm:w-auto"}>
          {actions}
        </div>
      ) : null}
    </header>
  )
}
