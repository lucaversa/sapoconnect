'use client'

import { useState } from 'react'
import { ArrowUpRight, CalendarDays, ShieldCheck, Wifi } from "lucide-react"

import { BrandOrbit } from "@/components/brand/BrandOrbit"
import { LoginForm } from "@/components/login-form"
import { Own3dScreen } from '@/components/own3d/Own3dScreen'
import { PageTransition, Reveal } from "@/components/ui/app-motion"

export default function LoginPage() {
  const [showRestrictedExperience, setShowRestrictedExperience] = useState(false)

  if (showRestrictedExperience) return <Own3dScreen />

  return (
    <main className="app-shell relative min-h-[100dvh] overflow-hidden px-4 py-5 sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -left-28 -top-32 size-80 rounded-full bg-primary/15 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 -right-24 size-96 rounded-full bg-sky-400/[0.09] blur-3xl" />

      <PageTransition className="relative z-10 mx-auto grid min-h-[calc(100dvh-2.5rem)] w-full max-w-6xl items-center gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.72fr)] lg:gap-14">
        <section className="hidden lg:block">
          <h1 className="max-w-xl text-5xl font-extrabold leading-[0.98] tracking-[-0.065em] text-gray-950 dark:text-white">
            O portal acadêmico, mais rápido no seu celular.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-gray-600 dark:text-gray-300">
            Um portal acadêmico otimizado para consultar horários, faltas, avaliações e histórico com menos espera.
          </p>

          <div className="relative mt-9 max-w-xl [perspective:1200px]">
            <div className="liquid-panel relative overflow-hidden rounded-[2rem] p-5 shadow-[0_36px_90px_-48px_rgba(0,0,0,0.72)] [transform:rotateY(-5deg)_rotateX(2deg)]">
              <div aria-hidden="true" className="absolute -right-16 -top-20 size-56 rounded-full bg-primary/15 blur-3xl" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="icon-orb size-11"><CalendarDays className="size-5" /></span>
                  <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Próximo bloco</p><p className="mt-0.5 font-extrabold text-gray-950 dark:text-white">Sua semana em foco</p></div>
                </div>
                <ArrowUpRight className="size-5 text-primary" />
              </div>
              <div className="relative mt-5 grid grid-cols-5 divide-x divide-white/70 overflow-hidden rounded-2xl border border-white/70 bg-white/35 dark:divide-white/[0.07] dark:border-white/[0.07] dark:bg-white/[0.025]">
                {["SEG", "TER", "QUA", "QUI", "SEX"].map((day, index) => (
                  <div key={day} className="px-2 py-3 text-center">
                    <p className="text-[9px] font-bold tracking-[0.08em] text-gray-400">{day}</p>
                    <span className={index === 2 ? "mx-auto mt-2 flex size-7 items-center justify-center rounded-xl bg-primary text-[11px] font-extrabold text-white" : "mx-auto mt-2 flex size-7 items-center justify-center text-[11px] font-bold text-gray-600 dark:text-gray-300"}>{18 + index}</span>
                    <span className={index === 2 ? "mx-auto mt-2 block h-7 w-1.5 rounded-full bg-primary" : "mx-auto mt-2 block h-4 w-1.5 rounded-full bg-gray-200 dark:bg-white/10"} />
                  </div>
                ))}
              </div>
              <div className="relative mt-4 flex gap-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/[0.08] px-3 py-1.5 text-primary-700 dark:text-primary-300"><Wifi className="size-3" /> cache inteligente</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-950/[0.04] px-3 py-1.5 dark:bg-white/[0.04]"><ShieldCheck className="size-3" /> sessão protegida</span>
              </div>
            </div>
          </div>
        </section>

        <Reveal delay={0.08} className="mx-auto my-auto w-full max-w-md py-4">
          <header className="mb-6 text-center">
            <BrandOrbit compact priority />
            <div className="-mt-1">
              <p className="text-2xl font-extrabold tracking-[-0.055em] text-gray-950 dark:text-white">Sapo<span className="text-primary">Connect</span></p>
              <p className="mt-0.5 text-[11px] font-bold tracking-[0.09em] text-gray-500 dark:text-gray-400">de aluno para aluno</p>
            </div>
            <h2 className="mt-5 text-2xl font-extrabold tracking-[-0.045em] text-gray-950 dark:text-white">Acesse seu portal otimizado</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">Entre com o mesmo RA e senha do EduConnect.</p>
          </header>

          <LoginForm onRestrictedExperience={() => setShowRestrictedExperience(true)} />

          <p className="mx-auto mt-4 max-w-sm text-center text-[11px] leading-5 text-gray-500 dark:text-gray-400">
            Reconexão protegida em cookie HttpOnly criptografado, sem banco de senhas.
          </p>
        </Reveal>
      </PageTransition>
    </main>
  )
}
