import { cn } from '@/lib/cn'
import { Symbol } from './logo'

/**
 * O X gigante e apagado ao fundo das telas de entrada.
 *
 * Vem das telas de referência, e é o tipo de ornamento que a seção 19 da
 * especificação **permite**: forma própria da marca, não arte de franquia. É a
 * alternativa correta ao mangá de fundo, que a mesma seção proíbe em voz alta.
 *
 * `aria-hidden` e fora do fluxo: é decoração, e repetir "ColeXa" para quem usa
 * leitor de tela em cima do logotipo que já está na tela seria ruído.
 */
export function BrandWatermark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 overflow-hidden',
        className,
      )}
    >
      <Symbol
        label={null}
        className={cn(
          'absolute h-[130%] w-auto -rotate-12',
          '-top-[15%] -right-[30%]',
          // Bem apagado: o contraste do conteúdo é medido contra o fundo, e uma
          // marca d'água forte comeria essa margem.
          'opacity-[0.04]',
        )}
      />
    </div>
  )
}
