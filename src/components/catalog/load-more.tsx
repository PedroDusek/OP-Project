'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * O fim da lista: o botão de carregar mais, o erro e o aviso de fim.
 *
 * Igual no catálogo e na coleção (20/09). O botão é também o sentinela da
 * rolagem — ele existe de verdade, e não é um `div` invisível, porque quem
 * navega por teclado precisa de algo para acionar.
 */
export function LoadMore({
  done,
  loading,
  error,
  shown,
  pageSize,
  onLoadMore,
  sentinel,
}: {
  done: boolean
  loading: boolean
  error: string | null
  /** Quantos itens já estão na tela, para saber se houve mais de uma leva. */
  shown: number
  pageSize: number
  onLoadMore: () => void
  sentinel: React.Ref<HTMLButtonElement>
}) {
  return (
    <>
      {error ? (
        <div role="alert" className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="secondary" onClick={onLoadMore}>
            Tentar de novo
          </Button>
        </div>
      ) : null}

      {done ? (
        shown > pageSize ? (
          <p className="py-4 text-center text-sm text-text-subtle">Fim da lista.</p>
        ) : null
      ) : (
        <Button
          ref={sentinel}
          variant="secondary"
          block
          onClick={onLoadMore}
          disabled={loading}
          className="mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Carregando
            </>
          ) : (
            'Carregar mais'
          )}
        </Button>
      )}
    </>
  )
}
