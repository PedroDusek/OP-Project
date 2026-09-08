import Link from 'next/link'
import { PackageOpen } from 'lucide-react'
import type { UnallocatedSummary } from '@/server/application/storage'
import { cn } from '@/lib/cn'

/**
 * O lembrete das cópias sem lugar.
 *
 * ## Por que é discreto, e não um alerta
 *
 * Cópia sem lugar registrado é estado **normal** (`business-rules.md` 3.2):
 * ninguém é obrigado a mapear a coleção inteira. Pintar isso de vermelho, com
 * `role="alert"`, diria que há algo quebrado — e uma tela que grita quando nada
 * está errado ensina a ignorá-la.
 *
 * Então é uma linha calma, na cor da marca, que some sozinha quando a conta
 * fecha. Convida, não cobra.
 *
 * ## Por que fica em Binders
 *
 * É aqui que a pessoa organiza, e o lembrete leva direto para a tela onde a
 * ação acontece. Na Home ele seria informação sobre um trabalho que se faz em
 * outro lugar.
 *
 * ## Por que some sem nenhum local criado
 *
 * Sem binder nenhum, **tudo** está sem lugar — o número seria o tamanho da
 * coleção inteira, e o convite, um beco: não há onde guardar. Nesse caso quem
 * fala é o estado vazio da lista, que manda criar o primeiro.
 */
export function UnallocatedNotice({
  summary,
  className,
}: {
  summary: UnallocatedSummary
  className?: string
}) {
  if (summary.copies === 0) return null

  return (
    <Link
      href="/binders/sem-lugar"
      className={cn(
        'flex items-center gap-3 rounded-card border border-accent/20 bg-accent-soft p-3',
        'transition-colors hover:brightness-[0.98]',
        className,
      )}
    >
      <PackageOpen className="size-5 shrink-0 text-accent-ink" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium text-accent-ink tabular-nums">
          {copiesLabel(summary.copies)} sem lugar
        </span>
        <span className="truncate text-xs text-text-muted tabular-nums">
          {cardsLabel(summary.cards)} esperando um binder, caixa ou deck.
        </span>
      </span>
      <span className="shrink-0 text-sm font-medium text-accent-ink">Organizar</span>
    </Link>
  )
}

/**
 * Cópias e cartas respondem coisas diferentes: as cópias dizem o tamanho do
 * trabalho, as cartas dizem quantas vezes se toca na tela.
 */
function copiesLabel(copies: number): string {
  return copies === 1 ? '1 cópia' : `${copies} cópias`
}

function cardsLabel(cards: number): string {
  return cards === 1 ? '1 carta' : `${cards} cartas`
}
