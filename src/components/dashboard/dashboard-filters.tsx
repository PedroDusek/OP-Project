'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Chip } from '@/components/ui/chip'
import { Select } from '@/components/ui/select'

/**
 * Os filtros do dashboard: coleção, raridade e cor (decisão 098, escolha do dono
 * do produto).
 *
 * Vivem na URL, e não em estado: o dashboard é desenhado no servidor, e o
 * endereço filtrado pode ser guardado ou mandado para alguém.
 */

const TODAS = '*'

export function DashboardFilters({
  sets,
  rarities,
  colors,
}: {
  sets: { code: string; label: string }[]
  rarities: string[]
  colors: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const colecao = params.get('colecao') ?? undefined
  const raridades = params.getAll('raridade')
  const cores = params.getAll('cor')

  const aplicar = (mudar: (novos: URLSearchParams) => void) => {
    const novos = new URLSearchParams(params.toString())
    mudar(novos)
    const texto = novos.toString()
    startTransition(() => router.replace(texto ? `${pathname}?${texto}` : pathname, { scroll: false }))
  }

  const alternar = (chave: string, valor: string) =>
    aplicar((novos) => {
      const atuais = novos.getAll(chave)
      novos.delete(chave)
      const proximos = atuais.includes(valor) ? atuais.filter((v) => v !== valor) : [...atuais, valor]
      for (const v of proximos) novos.append(chave, v)
    })

  const algum = Boolean(colecao) || raridades.length > 0 || cores.length > 0

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      <Select
        label="Coleção"
        value={colecao ?? TODAS}
        onValueChange={(valor) =>
          aplicar((novos) => {
            if (valor === TODAS) novos.delete('colecao')
            else novos.set('colecao', valor)
          })
        }
        options={[{ value: TODAS, label: 'Todas as coleções' }, ...sets.map((set) => ({ value: set.code, label: set.label }))]}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-muted">Raridade</span>
        <div className="flex flex-wrap gap-1.5">
          {rarities.map((raridade) => (
            <Chip key={raridade} selected={raridades.includes(raridade)} onClick={() => alternar('raridade', raridade)}>
              {raridade}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-muted">Cor</span>
        <div className="flex flex-wrap gap-1.5">
          {colors.map((cor) => (
            <Chip key={cor} selected={cores.includes(cor)} onClick={() => alternar('cor', cor)}>
              {cor}
            </Chip>
          ))}
        </div>
      </div>

      {algum ? (
        <button
          type="button"
          onClick={() =>
            aplicar((novos) => {
              novos.delete('colecao')
              novos.delete('raridade')
              novos.delete('cor')
            })
          }
          className="self-start text-sm font-medium text-accent-ink underline underline-offset-2"
        >
          Limpar filtros
        </button>
      ) : null}
    </div>
  )
}
