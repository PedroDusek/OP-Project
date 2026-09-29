'use client'

import { useActionState, useMemo, useState } from 'react'
import { recordDonSetsAction } from '@/app/dev/don/actions'
import { DON_SETS_IDLE } from '@/app/dev/don/state'
import { CardArt } from '@/components/catalog/card-art'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/states'
import { Panel } from '@/components/ui/surface'
import { SearchBar } from '@/components/ui/search-bar'
import { cn } from '@/lib/cn'
import type { DonSetOption, DonSetRow, DonSetsWorksheet } from '@/server/application/catalog'

/**
 * Em que coleção cada DON!! saiu (decisão 112).
 *
 * Cada linha é uma arte, com a foto, o nome e as coleções marcadas. Marcar é um
 * gesto local; gravar é explícito — são 239 artes, e uma ida ao servidor por
 * toque faria a lista pular sob o dedo.
 *
 * ## Duas abas, e a que falta vem primeiro
 *
 * O trabalho é longo e feito em várias sentadas. Abrir na aba do que **falta**
 * é abrir onde se parou; a lista inteira continua a um toque, para conferir o
 * que já foi dito.
 *
 * ## Por levas, e não as 239 de uma vez
 *
 * Cada linha traz um botão por coleção. Com 239 artes e 60 coleções, a página
 * inteira seriam **14 mil botões** — medido em 23/09: 3,4 s até desenhar, num
 * desktop. Em levas de 25 o desenho é imediato, e quem confere carta a carta
 * não rola 239 de uma vez de qualquer forma.
 */

/** Quantas artes por leva. */
const LEVA = 25

type Grupo = 'faltam' | 'todas'

export function DonSetsWorksheetView({ worksheet }: { worksheet: DonSetsWorksheet }) {
  const [grupo, setGrupo] = useState<Grupo>('faltam')
  const [termo, setTermo] = useState('')
  const [limite, setLimite] = useState(LEVA)

  const encontradas = useMemo(() => {
    const busca = termo.trim().toLowerCase()
    return worksheet.rows
      .filter((row) => (grupo === 'faltam' ? row.sets.length === 0 : true))
      .filter((row) => !busca || row.cardName.toLowerCase().includes(busca) || row.arte.includes(busca))
  }, [worksheet.rows, grupo, termo])

  /*
   * Trocar de aba ou buscar volta para a primeira leva: sem isto, buscar dentro
   * de uma lista ja expandida desenharia tudo de novo, que e o que a leva
   * existe para evitar.
   */
  const [ultimoRecorte, setUltimoRecorte] = useState(`${grupo}:${termo}`)
  if (ultimoRecorte !== `${grupo}:${termo}`) {
    setUltimoRecorte(`${grupo}:${termo}`)
    setLimite(LEVA)
  }

  const visiveis = encontradas.slice(0, limite)

  return (
    <div className="space-y-4">
      <Segmented
        label="O que mostrar"
        value={grupo}
        onValueChange={setGrupo}
        options={[
          { value: 'faltam' as const, label: 'Faltam', count: worksheet.faltam },
          { value: 'todas' as const, label: 'Todas', count: worksheet.rows.length },
        ]}
      />

      <SearchBar
        label="Buscar DON!!"
        value={termo}
        onValueChange={setTermo}
        onClear={() => setTermo('')}
        placeholder="Nome ou número do produto"
      />

      {visiveis.length === 0 ? (
        <EmptyState
          title={grupo === 'faltam' ? 'Nenhuma arte sem coleção' : 'Nada encontrado'}
          description={
            grupo === 'faltam'
              ? 'Todas as artes de DON!! já têm coleção informada.'
              : 'Ajuste a busca.'
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {visiveis.map((row) => (
              <li key={row.arte}>
                <Linha row={row} sets={worksheet.sets} />
              </li>
            ))}
          </ul>

          {encontradas.length > visiveis.length ? (
            <Button variant="secondary" block onClick={() => setLimite((atual) => atual + LEVA)}>
              Mostrar mais ({encontradas.length - visiveis.length} restantes)
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}

function Linha({ row, sets }: { row: DonSetRow; sets: DonSetOption[] }) {
  const [state, submit, pending] = useActionState(recordDonSetsAction, DON_SETS_IDLE)

  // O rascunho parte do que ja esta gravado; gravar e que manda para o arquivo.
  const [escolhidos, setEscolhidos] = useState<string[]>(row.sets)

  const alternar = (code: string) =>
    setEscolhidos((atual) =>
      atual.includes(code) ? atual.filter((item) => item !== code) : [...atual, code],
    )

  const gravado = state.status === 'saved' ? state.sets : row.sets
  const sujo = escolhidos.join('|') !== [...gravado].sort().join('|')

  return (
    <Panel className="flex flex-col gap-3 p-3">
      <div className="flex items-start gap-3">
        <CardArt src={row.imageUrl} alt="" fallback={row.cardCode} className="w-16 shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-text-subtle">{row.arte}</span>
            <span className="text-sm font-semibold text-text">{row.cardName}</span>
            {gravado.length === 0 ? (
              <Badge tone="warning">Sem coleção</Badge>
            ) : (
              <Badge tone="success">{gravado.join(', ')}</Badge>
            )}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {row.variantType}
            {row.rarity ? ` · ${row.rarity}` : ''}
          </p>
        </div>
      </div>

      <form action={submit} className="space-y-2">
        <input type="hidden" name="arte" value={row.arte} />
        {escolhidos.map((code) => (
          <input key={code} type="hidden" name="set" value={code} />
        ))}

        <div className="flex flex-wrap gap-1.5">
          {sets.map((set) => {
            const marcado = escolhidos.includes(set.code)
            return (
              <button
                key={set.code}
                type="button"
                onClick={() => alternar(set.code)}
                aria-pressed={marcado}
                title={set.displayName}
                className={cn(
                  'rounded-control border px-2 py-1 text-xs transition-colors',
                  marcado
                    ? 'border-accent-ink/40 bg-accent-soft font-semibold text-accent-ink'
                    : 'border-border bg-surface text-text-muted hover:bg-surface-muted',
                )}
              >
                {set.displayCode}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" loading={pending} disabled={!sujo}>
            Gravar
          </Button>
          {/* Limpar a escolha e o "nao sei" de volta: apaga a linha da tabela. */}
          {escolhidos.length > 0 ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setEscolhidos([])}>
              Limpar
            </Button>
          ) : null}
          {state.status === 'error' ? (
            <span role="alert" className="text-xs text-danger">
              {state.message}
            </span>
          ) : null}
          {state.status === 'saved' && !sujo ? (
            <span className="text-xs text-text-subtle">Gravado.</span>
          ) : null}
        </div>
      </form>
    </Panel>
  )
}
