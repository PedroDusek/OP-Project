'use client'

import { useMemo, useState } from 'react'
import { LigaCardForm } from '@/components/catalog/liga-worksheet'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/states'
import type { DuplicateReviewRow } from '@/server/application/catalog'

/**
 * A revisão das artes que a Liga deixa indistinguíveis — o mesmo tratamento, ou a
 * mesma página, para duas artes da mesma carta (decisão 073).
 *
 * É o que trava o vínculo com o TCGplayer: a regra não sabe qual das duas é qual,
 * e um produto não pode ter dois donos. Cada grupo aparece junto, carta por carta,
 * para quem revisa comparar as artes lado a lado.
 *
 * Duas saídas por arte: corrigir o endereço da Liga — a arte deixa de repetir e o
 * grupo some —, ou confirmar que a Liga não as distingue mesmo. Confirmadas todas,
 * o grupo sai da lista; o preço delas continua pelo mapeamento manual.
 */

const TODAS = 'todas'

const IDENTIDADE_LEGIVEL = (identidade: string) =>
  identidade.startsWith('sem tratamento em ')
    ? `a mesma página sem tratamento (${identidade.slice('sem tratamento em '.length)})`
    : `o mesmo tratamento "${identidade}"`

export function LigaDuplicateReview({ rows }: { rows: DuplicateReviewRow[] }) {
  const [set, setSet] = useState<string>(TODAS)

  const sets = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const row of rows) contagem.set(row.setCode, (contagem.get(row.setCode) ?? 0) + 1)
    return [...contagem]
  }, [rows])

  const ativo = set !== TODAS && !sets.some(([code]) => code === set) ? TODAS : set
  const visiveis = ativo === TODAS ? rows : rows.filter((row) => row.setCode === ativo)

  // Um bloco por grupo (carta + identidade), na ordem em que as linhas ja vem.
  const grupos = useMemo(() => {
    const porGrupo = new Map<string, DuplicateReviewRow[]>()
    for (const row of visiveis) {
      const chave = `${row.cardCode}|${row.identidade}`
      porGrupo.set(chave, [...(porGrupo.get(chave) ?? []), row])
    }
    return [...porGrupo.values()]
  }, [visiveis])

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nada para revisar"
        description="Nenhuma carta tem duas artes que a Liga deixa iguais."
      />
    )
  }

  return (
    <div className="space-y-4">
      <Segmented<string>
        label="Filtrar por coleção"
        value={ativo}
        onValueChange={setSet}
        options={[
          { value: TODAS, label: 'Todas', count: rows.length },
          ...sets.map(([code, count]) => ({ value: code, label: code, count })),
        ]}
      />

      <ul className="space-y-6">
        {grupos.map((membros) => (
          <li key={`${membros[0].cardCode}|${membros[0].identidade}`}>
            <section aria-label={`${membros[0].cardCode}: ${membros.length} artes iguais na Liga`} className="space-y-2">
              <h2 className="text-sm font-semibold text-text">
                {membros[0].cardCode} · {membros[0].cardName} — {membros.length} artes com{' '}
                {IDENTIDADE_LEGIVEL(membros[0].identidade)}
              </h2>
              <ul className="space-y-3">
                {membros.map((row) => (
                  <li key={row.sourceId}>
                    <LigaCardForm
                      row={row}
                      setCode={row.setCode}
                      review={{
                        motivo:
                          `A Liga dá a ${row.sourceId} e a ${row.irmas.join(', ')} ` +
                          `${IDENTIDADE_LEGIVEL(row.identidade)}: sem distinguir, nenhuma ganha preço pela regra. ` +
                          'Se uma delas está na página errada, cole a certa.',
                        confirmar: {
                          intencao: 'confirmar-mesma-identidade',
                          rotulo: 'A Liga não distingue estas artes',
                        },
                        tcgProductId: row.tcgProductId,
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          </li>
        ))}
      </ul>
    </div>
  )
}
