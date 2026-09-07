import { SYMBOL, LOGOTYPE } from '@/lib/marca'
import { cn } from '@/lib/cn'

/**
 * A marca, inline.
 *
 * Inline e nao `<img src="/marca/logotype.svg">` por causa do tema: um SVG
 * servido como arquivo nao recebe o CSS da pagina, entao so enxerga
 * `prefers-color-scheme` e erra sempre que a pessoa escolhe um tema diferente
 * do sistema. Inline, as letras herdam `currentColor` e o X usa o token, que ja
 * sabem os dois temas.
 *
 * Os arquivos em `public/marca/` continuam existindo para os contextos que nao
 * tem CSS nenhum: favicon, icone de app e compartilhamento.
 *
 * As curvas vem de `src/lib/marca.ts`, gerado do arquivo mestre da identidade.
 * Secao 2.2: nao alterar proporcoes nem construcao do X.
 */

interface MarkProps {
  className?: string
  /**
   * Rotulo acessivel. `null` marca a imagem como decorativa, para quando o
   * nome ja aparece escrito ao lado e repeti-lo so atrapalharia o leitor.
   */
  label?: string | null
}

export function Symbol({ className, label = 'ColeXa' }: MarkProps) {
  return (
    <svg
      viewBox={`0 0 ${SYMBOL.width} ${SYMBOL.height}`}
      className={cn('h-6 w-auto', className)}
      role={label ? 'img' : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={SYMBOL.path} fillRule={SYMBOL.fillRule} className="fill-accent" />
    </svg>
  )
}

export function Logotype({ className, label = 'ColeXa' }: MarkProps) {
  return (
    <svg
      viewBox={`0 0 ${LOGOTYPE.width} ${LOGOTYPE.height}`}
      className={cn('h-5 w-auto', className)}
      role={label ? 'img' : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={LOGOTYPE.letters} fillRule={LOGOTYPE.fillRule} fill="currentColor" />
      <path d={LOGOTYPE.symbol} fillRule={LOGOTYPE.fillRule} className="fill-accent" />
    </svg>
  )
}
