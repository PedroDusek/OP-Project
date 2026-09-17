'use client'

import { useEffect } from 'react'
import { TriangleAlert } from 'lucide-react'

/**
 * O que a pessoa vê quando uma página quebra (decisão 092).
 *
 * Mostra o **código** do erro (`digest`): é o mesmo que aparece no log do
 * servidor, e é o que um testador consegue mandar para acharmos a falha. A
 * mensagem do erro em si nunca aparece — em produção o Next já a esconde, e ela
 * poderia carregar detalhe do banco.
 */
export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <TriangleAlert className="size-10 text-danger" aria-hidden />
      <div className="flex max-w-sm flex-col gap-1">
        <h1 className="text-lg font-semibold text-text">Algo deu errado nesta página</h1>
        <p className="text-sm text-text-muted">
          Tente de novo. Se continuar, avise o suporte em suporte@colexa.com.br e informe o código
          abaixo.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-text-subtle">Código: {error.digest}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center rounded-control bg-accent px-4 text-sm font-medium text-white hover:opacity-90"
        >
          Tentar de novo
        </button>
        {/* `<a>`, e não `Link`: depois de um erro, recarregar do zero é o mais seguro. */}
        <a
          href="/inicio"
          className="inline-flex h-11 items-center rounded-control border border-border px-4 text-sm font-medium text-text hover:bg-surface-muted"
        >
          Ir para o início
        </a>
      </div>
    </main>
  )
}
