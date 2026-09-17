import { Sparkles } from 'lucide-react'
import { Panel } from '@/components/ui/surface'

/**
 * O que está no Premium, dito no lugar onde a pessoa esbarrou (decisão 093).
 *
 * Sem preço e sem botão de assinar: o meio de pagamento é decisão do dono do
 * produto para depois do beta, e um botão que não leva a lugar nenhum é pior que
 * a ausência dele. Enquanto isso, diz onde pedir.
 */
export function PremiumNotice({ title, description }: { title: string; description: string }) {
  return (
    <Panel className="flex items-start gap-3 p-4">
      <Sparkles className="mt-0.5 size-5 shrink-0 text-accent-ink" aria-hidden />
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        <p className="text-sm text-text-muted">{description}</p>
        <p className="text-xs text-text-subtle">
          A assinatura ainda não está aberta. Durante o teste, peça o acesso em suporte@colexa.com.br.
        </p>
      </div>
    </Panel>
  )
}
