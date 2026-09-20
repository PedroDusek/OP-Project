'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Carregar mais, por toque e por rolagem.
 *
 * Nasceu dentro de `InfiniteCardGrid` e saiu daqui em 20/09, quando Minha
 * Coleção precisou do mesmo comportamento: ela mostrava no máximo 100 cartas e
 * não tinha como ver o resto. Duas cópias desta mecânica divergiriam no
 * primeiro ajuste — a trava contra chamada dupla, o reinício ao trocar de
 * filtro, a margem de 600 px — e só uma delas seria corrigida.
 *
 * O que muda entre as duas telas é o endereço da API e o que cada item carrega;
 * o resto é igual.
 */
export function useInfiniteItems<T>({
  initialItems,
  total,
  endpoint,
  apiQuery,
}: {
  initialItems: T[]
  total: number
  /** A rota que devolve `{ items }`, já com a página pedida. */
  endpoint: string
  /** A consulta sem `page`, já traduzida do português da URL. */
  apiQuery: string
}) {
  const [items, setItems] = useState(initialItems)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinel = useRef<HTMLButtonElement>(null)

  /*
   * Mudar de filtro troca `initialItems` sem desmontar o componente. Sem este
   * ajuste, a lista nova apareceria concatenada com a antiga, e a pessoa veria
   * resultados que nao pediu no meio dos que pediu.
   *
   * O ajuste acontece durante a renderizacao, e nao num efeito: num efeito, a
   * tela chegaria a ser pintada com a lista errada antes da correcao.
   */
  const [lastInitial, setLastInitial] = useState(initialItems)
  if (initialItems !== lastInitial) {
    setLastInitial(initialItems)
    setItems(initialItems)
    setPage(1)
    setError(null)
  }

  const done = items.length >= total

  /*
   * A trava e uma referencia, e nao o estado: o estado so muda na proxima
   * renderizacao, e duas chamadas no mesmo quadro — o toque e o observador
   * juntos — passariam as duas pela guarda.
   */
  const busy = useRef(false)

  const loadMore = useCallback(async () => {
    if (busy.current || loading || done) return
    busy.current = true

    setLoading(true)
    setError(null)
    const next = page + 1

    try {
      const response = await fetch(`${endpoint}?${apiQuery}&page=${next}`)
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        throw new Error(body?.error?.message ?? 'Não foi possível carregar mais cartas.')
      }

      const data = (await response.json()) as { items: T[] }
      setItems((current) => [...current, ...data.items])
      setPage(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar mais cartas.')
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [apiQuery, done, endpoint, loading, page])

  /** A versao mais recente, para o observador nao precisar ser remontado. */
  const latest = useRef(loadMore)
  useEffect(() => {
    latest.current = loadMore
  }, [loadMore])

  useEffect(() => {
    const node = sentinel.current
    if (!node || done) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void latest.current()
      },
      // Comeca a buscar antes de a pessoa chegar no fim, para a proxima leva
      // ja estar la quando ela chegar.
      { rootMargin: '600px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [done])

  return { items, loading, error, done, loadMore, sentinel }
}
