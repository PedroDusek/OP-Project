'use client'

import { useMemo, useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { ProgressBar } from '@/components/ui/progress-bar'
import { SearchBar } from '@/components/ui/search-bar'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/states'
import { Panel } from '@/components/ui/surface'
import { PLAYSET_SIZE } from '@/server/domain/collection/counting'
import { missingCopies } from '@/server/domain/collection/playsets'
import type { PlaysetCardRow } from '@/server/application/collection'
import { cn } from '@/lib/cn'

/**
 * Os playsets de uma coleção, **inclusive os que estão em zero** (decisão 114).
 *
 * Até 23/11 esta lista era a tela 19 e saía da coleção: ela só conhecia as
 * cartas que a pessoa tinha, e o menor valor possível era `1/4`. Agora o
 * universo é o catálogo, e o `0/4` é o que a tela existe para mostrar — é
 * olhando para ele que se sabe qual playset fechar.
 *
 * ## É lista, e não grade
 *
 * A coleção mostra uma grade de artes, porque lá a pergunta é "o que eu tenho".
 * Aqui a pergunta é "quanto falta", e a resposta é um número por linha: numa
 * grade ele seria um selo em cima da arte, do tamanho de um selo, e a leitura
 * de vinte cartas seguidas viraria vinte paradas. A lista põe o número, a barra
 * e o aviso na mesma linha do nome.
 *
 * A barra usa `value` e `total` em vez de porcentagem: o leitor de tela anuncia
 * "3 de 4", que é a informação — e uma carta a que faltam duas cópias não deve
 * soar igual a uma a que falta uma.
 *
 * Passar de quatro cópias não passa de 100%: o playset é binário por carta
 * (`business-rules.md` 2.1), e uma barra em 250% diria que existe algo a mais
 * para alcançar.
 */
export function PlaysetList({ rows }: { rows: PlaysetCardRow[] }) {
  const [scope, setScope] = useState<'all' | 'closed' | 'open'>('all')
  const [term, setTerm] = useState('')

  const counts = useMemo(
    () => ({
      all: rows.length,
      closed: rows.filter((row) => row.closed).length,
      open: rows.filter((row) => !row.closed).length,
    }),
    [rows],
  )

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return rows.filter((row) => {
      if (scope === 'closed' && !row.closed) return false
      if (scope === 'open' && row.closed) return false
      if (!needle) return true
      return (
        row.cardCode.toLowerCase().includes(needle) || row.cardName.toLowerCase().includes(needle)
      )
    })
  }, [rows, scope, term])

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Recorte dos playsets"
        value={scope}
        onValueChange={setScope}
        options={[
          { value: 'all', label: 'Todos', count: counts.all },
          { value: 'closed', label: 'Completos', count: counts.closed },
          { value: 'open', label: 'Faltam', count: counts.open },
        ]}
      />

      <SearchBar
        label="Buscar nos playsets"
        value={term}
        onValueChange={setTerm}
        placeholder="Buscar por código ou nome..."
      />

      {matches.length === 0 ? (
        <EmptyState title="Nada neste recorte" description="Ajuste a busca, os filtros ou a aba." />
      ) : (
        <ul className="flex flex-col gap-2">
          {matches.map((row) => (
            <li key={row.cardCode}>
              <Panel className="flex items-center gap-3 p-3">
                <CardArt
                  src={row.imageUrl}
                  alt=""
                  fallback={row.cardCode}
                  sizes="44px"
                  className="w-11 shrink-0 rounded-md"
                />

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-sm font-semibold text-text tabular-nums">
                    {row.cardCode}
                  </p>
                  <p className="truncate text-xs text-text-muted">{row.cardName}</p>
                  <ProgressBar
                    label={`Playset de ${row.cardCode}`}
                    value={Math.min(row.quantity, PLAYSET_SIZE)}
                    total={PLAYSET_SIZE}
                    className="mt-0.5"
                  />
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      row.closed ? 'text-success' : 'text-text',
                    )}
                  >
                    {row.quantity}
                    <span className="text-text-subtle">/{PLAYSET_SIZE}</span>
                  </span>

                  {row.closed ? (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <CircleCheck className="size-3.5" aria-hidden />
                      Completo
                    </span>
                  ) : (
                    /*
                      "Faltam 4" e nao "0/4" de novo: o numero que a pessoa leva
                      para a loja e o que falta, e ela nao deveria subtrair de
                      cabeca numa lista de duzentas linhas.
                    */
                    <span className="text-xs text-text-muted tabular-nums">
                      {missingCopies(row.quantity) === 1
                        ? 'falta 1'
                        : `faltam ${missingCopies(row.quantity)}`}
                    </span>
                  )}

                  {/*
                    O aviso de arte paralela (decisao 095, item 4a, e agora
                    tambem aqui). As mesmas palavras e a mesma cor que a
                    transferencia da decklist ja usa: um 4/4 com uma paralela
                    aparecia so como "completo", e quem fecha playset muitas
                    vezes quer quatro iguais.
                  */}
                  {row.otherArtCopies > 0 ? (
                    <span className="text-xs text-warning tabular-nums">
                      {row.otherArtCopies === 1
                        ? '1 de outra arte'
                        : `${row.otherArtCopies} de outra arte`}
                    </span>
                  ) : null}
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
