'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Panel } from '@/components/ui/surface'
import { setUsernameAction } from '@/app/(app)/conta/actions'
import { USERNAME_IDLE } from '@/app/(app)/conta/state'
import { USERNAME_MAX } from '@/server/domain/social/username'
import type { UsernameState } from '@/server/application/social'

/**
 * Escolher ou trocar o nome de usuário.
 *
 * ## Por que a tela insiste que ele é público
 *
 * É a **única** identidade que outras pessoas veem (`business-rules.md`
 * 6.1.1) — nome real e e-mail nunca aparecem. Quem escolhe sem saber disso pode
 * pôr o nome completo achando que é um apelido interno.
 *
 * ## A espera aparece antes de a pessoa tentar
 *
 * Uma troca por semana. Descobrir o limite depois de digitar um nome novo é
 * pior que ver a data no lugar do campo: no primeiro caso a pessoa perdeu o
 * trabalho, no segundo ela sabe quando voltar.
 */
export function UsernameForm({ state: atual }: { state: UsernameState }) {
  const [state, submit, salvando] = useActionState(setUsernameAction, USERNAME_IDLE)

  const podeTrocar = atual.nextChangeAt === null || atual.nextChangeAt <= new Date()
  const nome = state.status === 'saved' ? state.username : atual.username
  const erro = state.status === 'error' ? (state.fields.username?.[0] ?? state.message) : undefined

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text">
          {nome ? 'Seu nome na rede' : 'Escolha seu nome na rede'}
        </h3>
        <p className="mt-1 text-sm text-text-muted">
          É o único dado que outras pessoas veem de você, junto do seu Trade Binder. Seu nome e seu
          e-mail continuam invisíveis.
        </p>
      </div>

      {podeTrocar ? (
        <form action={submit} className="flex flex-col gap-3">
          <Field
            label="Nome na rede"
            hideLabel
            error={erro}
            hint="Letras sem acento, números, ponto ou sublinhado. Pode trocar uma vez por semana."
          >
            {(props) => (
              <div className="flex gap-2">
                <Input
                  {...props}
                  name="username"
                  defaultValue={nome ?? ''}
                  maxLength={USERNAME_MAX}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="ana_tcg"
                  className="min-w-0 flex-1"
                />
                <Button type="submit" loading={salvando}>
                  Salvar
                </Button>
              </div>
            )}
          </Field>
        </form>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-text">@{nome}</p>
          <p className="text-xs text-text-muted">
            Você já trocou esta semana. Poderá trocar de novo em{' '}
            {formatDate(atual.nextChangeAt as Date)}.
          </p>
        </div>
      )}
    </Panel>
  )
}

/**
 * Data em português, no fuso de São Paulo.
 *
 * O fuso é fixo e não o do navegador: sem fixar, a data trocaria entre a versão
 * em cache e a recém-gerada.
 */
function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(value)
}
