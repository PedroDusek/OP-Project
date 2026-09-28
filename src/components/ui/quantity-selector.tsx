'use client'

import { Minus, Plus } from 'lucide-react'
import { PLAYSET_SIZE } from '@/server/domain/collection/counting'
import { cn } from '@/lib/cn'

/**
 * Seletor de quantidade: menos, numero, mais.
 *
 * Os dois botoes tem 44 px e ficam nas pontas, alcancaveis com um polegar so
 * (`architecture.md` 4.1). O numero no meio e um `<input type="text"
 * inputMode="numeric">` e nao `type="number"`: o campo numerico do navegador
 * traz setas proprias que competem com estes botoes, e no celular abre um
 * teclado com virgula e sinal que nao servem para contar copias.
 *
 * Este componente **nao persiste nada**. Reduzir a quantidade abaixo do que ja
 * esta alocado devolve conflito do servidor com as alocacoes atuais, para a
 * pessoa escolher de onde as copias saem (`docs/business-rules.md` 3.3). Essa
 * tela de resolucao e do Checkpoint 9; aqui so existe o controle.
 *
 * ## O `+4`
 *
 * Opcional, e so nas telas onde o gesto e **cadastrar carta**. Quatro nao e um
 * numero redondo qualquer: e o playset (`PLAYSET_SIZE`), o que se tem de uma
 * carta para poder jogar com ela. Quem cadastra colecao grande toca `+` quatro
 * vezes por carta, e foi disso que o dono do produto reclamou.
 *
 * Ele nao entra onde a quantidade significa outra coisa — alocar entre locais,
 * montar troca —, porque ali quatro nao quer dizer nada de especial.
 *
 * Ele tem o **mesmo tamanho** dos outros dois. A primeira versao o fez estreito,
 * com largura de texto, para proteger telas apertadas — e o dono do produto
 * apontou, com a tela na mao, que na folha de adicionar a colecao ele ficava
 * pequeno perto dos vizinhos. Quem usa `QuantitySelector` com `bulk` sao folhas
 * de largura cheia, onde sobra espaco; a tela apertada de verdade e a grade de
 * duas colunas do seletor em massa, que tem controle proprio e resolve por la,
 * com o `+4` em linha propria.
 */

export interface QuantitySelectorProps {
  value: number
  onValueChange: (value: number) => void
  label: string
  min?: number
  max?: number
  disabled?: boolean
  size?: 'md' | 'lg'
  /** Mostra o `+4`, para as telas de cadastrar carta. Ver o bloco acima. */
  bulk?: boolean
  className?: string
}

export function QuantitySelector({
  value,
  onValueChange,
  label,
  min = 0,
  max = 9999,
  disabled = false,
  size = 'md',
  bulk = false,
  className,
}: QuantitySelectorProps) {
  const clamp = (next: number) => Math.min(Math.max(next, min), max)
  const button = size === 'lg' ? 'size-13' : 'size-11'

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-label={`Diminuir ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onValueChange(clamp(value - 1))}
        className={cn(
          button,
          'inline-flex shrink-0 items-center justify-center rounded-control',
          'border border-border bg-surface text-text transition-colors',
          'hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <Minus className="size-4" aria-hidden />
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={label}
        disabled={disabled}
        value={value}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '')
          // Campo vazio vira o minimo em vez de NaN: apagar tudo para digitar
          // outro numero e o gesto normal, e nao pode quebrar a tela no meio.
          onValueChange(clamp(digits === '' ? min : Number(digits)))
        }}
        className={cn(
          'h-11 min-w-0 flex-1 rounded-control border border-border bg-surface',
          'text-center text-base font-semibold text-text tabular-nums',
          'outline-none transition-colors focus-visible:border-accent-ink',
          'disabled:opacity-45',
          size === 'lg' && 'h-13 text-lg',
        )}
      />

      <button
        type="button"
        aria-label={`Aumentar ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onValueChange(clamp(value + 1))}
        className={cn(
          button,
          'inline-flex shrink-0 items-center justify-center rounded-control',
          'border border-accent-ink/30 bg-accent-soft text-accent-ink transition-colors',
          'hover:brightness-95 disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <Plus className="size-4" aria-hidden />
      </button>

      {bulk ? (
        <button
          type="button"
          aria-label={`Acrescentar ${PLAYSET_SIZE} a ${label}`}
          disabled={disabled || value >= max}
          onClick={() => onValueChange(clamp(value + PLAYSET_SIZE))}
          className={cn(
            button,
            'inline-flex shrink-0 items-center justify-center rounded-control',
            'border border-accent-ink/30 bg-accent-soft font-semibold',
            'text-accent-ink tabular-nums transition-colors',
            size === 'lg' ? 'text-base' : 'text-sm',
            'hover:brightness-95 disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          +{PLAYSET_SIZE}
        </button>
      ) : null}
    </div>
  )
}
