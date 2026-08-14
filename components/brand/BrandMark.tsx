import Image from "next/image"

import { cn } from "@/lib/utils"

type BrandMarkProps = {
  className?: string
  title?: string
  priority?: boolean
}

export function BrandMark({ className, title = "SapoConnect", priority = false }: BrandMarkProps) {
  return (
    <span className={cn("relative block shrink-0 overflow-hidden rounded-[28%]", className)}>
      <Image
        src="/brand/sapoconnect-icon-96.png"
        alt={title}
        fill
        priority={priority}
        sizes="96px"
        className="object-cover"
      />
    </span>
  )
}

export function BrandLockup({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <BrandMark className={cn("size-11 shadow-[0_12px_28px_-14px_rgba(0,172,147,0.8)]", compact && "size-10")} />
      <div className="min-w-0">
        <p className="truncate text-[15px] font-extrabold tracking-[-0.035em] text-gray-950 dark:text-white">
          Sapo<span className="text-primary">Connect</span>
        </p>
        <p className="truncate text-[10px] font-semibold tracking-[0.05em] text-gray-500 dark:text-gray-400">
          de aluno para aluno
        </p>
      </div>
    </div>
  )
}
