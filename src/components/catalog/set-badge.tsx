import { Symbol } from '@/components/brand/logo'
import { cn } from '@/lib/cn'

/**
 * A marca do set na lista: o código, no estilo visual do ColeXa.
 *
 * ## Por que não é o logo oficial
 *
 * A Bandai publica um logo por coleção, mas só nas páginas de produto dos
 * lançamentos recentes, e a URL carrega um hash aleatório que não se deriva do
 * código:
 *
 *     /onepiececg/bccard/en/products/2026/03/26/FQ6NL0F7vwkybKBR/logo.webp
 *
 * `op01.html`, `st01.html` e `eb01.html` devolvem 404 — só os produtos novos têm
 * página, o índice é montado por JavaScript, o sitemap tem duas URLs e não há
 * endpoint de dados. Cobrir os sessenta sets exigiria hospedar as imagens por
 * conta própria.
 *
 * ## Por que não a arte de uma carta
 *
 * Numa linha de lista o quadro tem 44 px de largura. Uma carta ali é uma fatia
 * de ilustração que não se reconhece — enquanto `OP13` se lê de imediato, que é
 * o que a pessoa está procurando.
 *
 * No cabeçalho do set, onde há espaço, a arte continua: lá ela ambienta em vez
 * de identificar.
 */
export function SetBadge({ code, className }: { code: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex aspect-[5/7] w-11 shrink-0 items-center justify-center overflow-hidden',
        'rounded-md border border-accent/20 bg-accent-soft',
        className,
      )}
    >
      <Symbol
        label={null}
        className="absolute -right-2 -bottom-1 h-8 w-auto opacity-20 [&_path]:fill-accent-ink"
      />
      <span className="relative px-0.5 text-center text-[10px] leading-tight font-bold text-accent-ink">
        {code}
      </span>
    </span>
  )
}
