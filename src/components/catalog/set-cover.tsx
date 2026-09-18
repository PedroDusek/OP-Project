import Image from 'next/image'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { normalizeSetCode } from '@/server/domain/catalog/sets'

/**
 * A imagem do produto — o pacote da coleção, a caixa do deck —, feita pelo dono
 * do produto.
 *
 * Cada uma existe em duas versões, porque a forma roxa da marca atrás do produto
 * muda de tom com o tema. O fundo liso das originais foi tirado em
 * `scripts/preparar-capas.ts`, e a imagem se mistura a qualquer superfície do
 * tema em que está.
 *
 * ## As duas versões no HTML, e o CSS escolhe
 *
 * O tema pode vir do sistema ou da escolha da pessoa (`data-theme`), e só o CSS
 * sabe qual vale — o servidor não. `<picture>` com `prefers-color-scheme`
 * ignoraria a escolha. As duas vão na página; a do outro tema fica em
 * `display: none` (`.so-tema-claro`/`.so-tema-escuro`, em `globals.css`), e o
 * navegador não baixa imagem preguiçosa que não aparece.
 *
 * ## O corte da forma roxa
 *
 * A forma da marca sai pela direita e por baixo da imagem, cortada reta. Onde a
 * imagem encosta no canto de um quadro — o cabeçalho do set —, o corte coincide
 * com a borda e a forma parece continuar para fora (`esmaecer={false}`). Num
 * quadro solto, as duas bordas esmaecem, para o corte não aparecer.
 *
 * Set sem imagem — os promocionais, e o que sair antes de o dono do produto
 * desenhar — mostra o `fallback`.
 */

/** Os códigos que têm imagem, normalizados. Gerado por `scripts/preparar-capas.ts`. */
const COM_CAPA = new Set([
  'EB01', 'EB02', 'EB03',
  'OP01', 'OP02', 'OP03', 'OP04', 'OP05', 'OP06', 'OP07', 'OP08', 'OP09', 'OP10',
  'OP11', 'OP12', 'OP13', 'OP14EB04', 'OP15EB04', 'OP16', 'OP17',
  'PRB01', 'PRB02',
  'ST01', 'ST02', 'ST03', 'ST04', 'ST05', 'ST06', 'ST07', 'ST08', 'ST09', 'ST10',
  'ST11', 'ST12', 'ST13', 'ST14', 'ST15', 'ST16', 'ST17', 'ST18', 'ST19', 'ST20',
  'ST21', 'ST22', 'ST23', 'ST24', 'ST25', 'ST26', 'ST27', 'ST28', 'ST29', 'ST30',
  'ST31', 'ST32', 'ST33', 'ST34', 'ST35', 'ST36',
])

export function hasSetCover(code: string): boolean {
  return COM_CAPA.has(normalizeSetCode(code))
}

export function SetCover({
  code,
  alt,
  sizes,
  className,
  fallback = null,
  esmaecer = true,
}: {
  code: string
  /** Vazio quando o nome do set já está escrito ao lado. */
  alt: string
  sizes: string
  className?: string
  fallback?: ReactNode
  esmaecer?: boolean
}) {
  if (!hasSetCover(code)) return <>{fallback}</>
  const arquivo = `${normalizeSetCode(code).toLowerCase()}.webp`

  return (
    // 540x755: a proporção das imagens, quase a de uma carta.
    <span
      className={cn(
        'relative block aspect-[540/755] shrink-0',
        // O produto ocupa até ~86% da largura e ~91% da altura: a esmaecida não o alcança.
        esmaecer &&
          '[mask-image:linear-gradient(to_right,black_84%,transparent),linear-gradient(to_bottom,black_90%,transparent)] [mask-composite:intersect]',
        className,
      )}
    >
      <Image
        src={`/sets/claro/${arquivo}`}
        alt={alt}
        fill
        sizes={sizes}
        className="so-tema-claro object-contain"
      />
      <Image
        src={`/sets/escuro/${arquivo}`}
        alt={alt}
        fill
        sizes={sizes}
        className="so-tema-escuro object-contain"
      />
    </span>
  )
}
