import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Panel } from '@/components/ui/surface'

/**
 * O que está no Premium, dito no lugar onde a pessoa esbarrou (decisão 093).
 *
 * **Leva para a tela de assinar** desde a decisão 102, que fechou preço e meio
 * de pagamento. Até então dizia para escrever ao suporte, porque um botão que
 * não leva a lugar nenhum é pior que a ausência dele. O preço não aparece aqui:
 * quem esbarrou na trava está no meio de outra coisa, e a tela de Premium é que
 * existe para comparar planos.
 */
export function PremiumNotice({ title, description }: { title: string; description: string }) {
  return (
    <Panel className="flex items-start gap-3 p-4">
      <Sparkles className="mt-0.5 size-5 shrink-0 text-accent-ink" aria-hidden />
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        <p className="text-sm text-text-muted">{description}</p>
        <Link
          href="/conta/premium"
          className="mt-1 text-sm font-medium text-accent-ink underline underline-offset-2"
        >
          Ver o Premium
        </Link>
      </div>
    </Panel>
  )
}
