'use client'

import { useState, useSyncExternalStore } from 'react'

/**
 * O que roda neste aparelho.
 *
 * Três perguntas diferentes, e a ordem em que falham diz onde está o problema:
 *
 *   - **React hidratou** — o pacote do cliente subiu e executou.
 *   - **O botão conta** — o evento chega até aqui. Hidratar e receber toque não
 *     são a mesma coisa: um elemento por cima captura o toque com o React vivo,
 *     que foi exatamente o defeito do painel de avisos.
 *   - **Erros** — o que o registrador do `<head>` guardou antes disso tudo.
 *
 * A primeira renderização do cliente responde o mesmo que o servidor, e a troca
 * acontece na assinatura, que roda depois da hidratação. O contrário criaria uma
 * divergência de verdade, e a página passaria a acusar um erro próprio.
 */

let mounted = false
const listeners = new Set<() => void>()

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  if (!mounted) {
    mounted = true
    onStoreChange()
  }
  return () => {
    listeners.delete(onStoreChange)
  }
}

/** O que o script do `<head>` guardou. Vazio até hidratar, para não divergir. */
function readErrors(): string {
  if (!mounted) return ''
  const found = (window as { __colexaErros?: string[] }).__colexaErros
  return found && found.length > 0 ? found.join('\n') : ''
}

export function Probe() {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => (mounted ? 'sim' : 'não'),
    () => 'não',
  )
  const errors = useSyncExternalStore(subscribe, readErrors, () => '')
  const [clicks, setClicks] = useState(0)

  const lines = errors ? errors.split('\n') : []

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text">O que roda aqui</h2>
        <dl className="divide-y divide-border rounded-card border border-border bg-surface">
          <Row label="React hidratou">{hydrated}</Row>
          <Row label="O botão conta">
            <button
              type="button"
              onClick={() => setClicks((n) => n + 1)}
              className="inline-flex h-11 items-center justify-center rounded-control border border-border bg-surface px-3 text-sm font-medium text-text"
            >
              Toques: {clicks}
            </button>
          </Row>
          <Row label="Algum erro de script">{lines.length > 0 ? 'sim' : 'não'}</Row>
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text">Erros capturados</h2>
        {lines.length === 0 ? (
          <p className="text-xs text-text-subtle">
            Nenhum — o que é bom sinal, a menos que &quot;React hidratou&quot; esteja em não.
          </p>
        ) : (
          <ul className="flex list-inside list-disc flex-col gap-1 rounded-control border border-border bg-surface p-3 text-xs break-all text-danger">
            {lines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-sm font-semibold text-text tabular-nums">{children}</dd>
    </div>
  )
}
