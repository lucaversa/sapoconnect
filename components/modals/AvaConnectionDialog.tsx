'use client'

import { useState, type FormEvent } from 'react'
import { ExternalLink, Link2, LockKeyhole, Unplug } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAvaIntegration } from '@/lib/ava-integration-provider'
import { useSession } from '@/lib/session-provider'

const DEFAULT_AVA_URL = 'https://ava.cmmg.edu.br'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível conectar ao AVA.'
}

export function AvaConnectionDialog() {
  const { user } = useSession()
  const {
    connection,
    isDialogOpen,
    setDialogOpen,
    connect,
    disconnect,
  } = useAvaIntegration()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const avaUrl = connection.moodleUrl || DEFAULT_AVA_URL

  const changeOpen = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setPassword('')
      setError(null)
    }
  }

  const handleConnect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      await connect(password)
      setPassword('')
      setDialogOpen(false)
      toast.success('AVA conectado com sucesso.')
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDisconnect = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      await disconnect()
      setDialogOpen(false)
      toast.success('Integração com o AVA desativada.')
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={changeOpen}>
      <DialogContent data-pull-to-refresh-ignore className="gap-0 p-0 sm:max-w-md sm:p-0">
        <DialogHeader className="border-b border-gray-200/75 px-5 pb-5 pr-16 pt-5 dark:border-white/[0.065] sm:px-6 sm:pt-6">
          <span className="icon-orb mb-3 size-11">
            {connection.connected ? <Link2 className="size-5" aria-hidden="true" /> : <LockKeyhole className="size-5" aria-hidden="true" />}
          </span>
          <DialogTitle>{connection.connected ? 'Integração com o AVA' : 'Conectar ao AVA'}</DialogTitle>
          <DialogDescription className="text-sm leading-6">
            {connection.connected
              ? 'Materiais e atividades do semestre atual estão disponíveis no SapoConnect.'
              : 'A senha do AVA pode ser diferente da senha usada no EduConnect.'}
          </DialogDescription>
        </DialogHeader>

        {connection.connected ? (
          <div className="space-y-4 px-5 py-5 sm:px-6 sm:pb-6">
            <div className="content-surface p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Conta conectada</p>
              <p className="mt-1 break-words text-sm font-extrabold text-gray-950 dark:text-white">
                {connection.fullName || connection.username || user?.ra}
              </p>
              {connection.username ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Usuário {connection.username}</p> : null}
            </div>
            {error ? <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-300">{error}</p> : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild variant="outline" className="gap-2">
                <a href={avaUrl} target="_blank" rel="noopener noreferrer">
                  Abrir AVA <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              </Button>
              <Button type="button" variant="destructive" onClick={() => void handleDisconnect()} disabled={isSubmitting} className="gap-2">
                <Unplug className="size-4" aria-hidden="true" />
                {isSubmitting ? 'Desconectando...' : 'Desconectar'}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="space-y-4 px-5 py-5 sm:px-6 sm:pb-6">
            <div className="space-y-2">
              <Label htmlFor="ava-username">Usuário do AVA</Label>
              <div id="ava-username" className="flex min-h-11 items-center rounded-[0.9rem] border border-gray-200 bg-gray-100/70 px-3 text-sm font-bold text-gray-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200">
                {user?.ra || 'Seu RA'}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ava-password">Senha do AVA</Label>
              <Input
                id="ava-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                required
                autoFocus
              />
              <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                A senha é usada uma única vez para obter a conexão e não é armazenada pelo SapoConnect.
              </p>
            </div>
            {error ? <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-300">{error}</p> : null}
            <Button type="submit" disabled={!password || isSubmitting} className="w-full gap-2">
              <Link2 className="size-4" aria-hidden="true" />
              {isSubmitting ? 'Conectando...' : 'Conectar AVA'}
            </Button>
            <a href={`${avaUrl}/login/forgot_password.php`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 text-xs font-bold text-primary-700 hover:underline dark:text-primary-300">
              Esqueci minha senha <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
