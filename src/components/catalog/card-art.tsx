import Image from 'next/image'
import { cn } from '@/lib/cn'

/**
 * A arte de uma carta.
 *
 * ## Por que passa pelo nosso servidor
 *
 * O servidor da Bandai responde com `cross-origin-resource-policy: same-site`
 * em toda imagem do catalogo. E uma instrucao ao **navegador** para recusar
 * exibi-la em qualquer origem que nao seja a deles: nao ha cabecalho nosso que
 * contorne, e vale igual para `localhost` e para `colexa.com.br`. As quatro
 * origens da Bandai foram testadas, todas iguais.
 *
 * Entao referenciar direto, como a decisao 026 previa, nao desenha nada. A
 * imagem passa pelo otimizador do Next, que busca uma vez, converte e serve do
 * nosso dominio. Ver a decisao 038.
 *
 * Isso e **mais leve** para a fonte do que a alternativa de nao guardar: sem
 * cache, cada visitante geraria uma requisicao a Bandai por carta vista.
 *
 * ## Proporcao
 *
 * O container define 5/7, a proporcao da carta fisica, e a imagem preenche com
 * `fill`. Fixa-la evita que a grade pule quando as imagens chegam fora de ordem.
 */

/** A grade tem 3 colunas no celular e chega a 8; a imagem pedida acompanha. */
const GRID_SIZES = '(max-width: 767px) 33vw, (max-width: 1023px) 25vw, (max-width: 1279px) 17vw, 12vw'

export interface CardArtProps {
  src: string | null
  /** Vazio marca a arte como decorativa, quando o codigo ja aparece ao lado. */
  alt: string
  /** Codigo, mostrado quando nao ha imagem. */
  fallback?: string
  className?: string
  sizes?: string
  /** Carrega sem esperar a rolagem. Para a arte principal de uma tela. */
  priority?: boolean
  /**
   * Carrega ja, sem esperar a rolagem e sem pre-carregar.
   *
   * Diferente de `priority`, que alem de carregar cedo emite uma dica de
   * pre-carregamento no `<head>` — util para **uma** imagem, e o Next avisa
   * quando sao muitas.
   *
   * Existe para a folha da want list. Ali a grade inteira precisa estar
   * desenhada antes de imprimir, e o carregamento preguicoso mandava para o PDF
   * paginas sem arte nenhuma: o que nunca passou pela tela nunca foi buscado.
   */
  eager?: boolean
}

export function CardArt({
  src,
  alt,
  fallback,
  className,
  sizes = GRID_SIZES,
  priority = false,
  eager = false,
}: CardArtProps) {
  return (
    <span
      className={cn(
        'relative block aspect-[5/7] w-full overflow-hidden rounded-card',
        'border border-border bg-surface-muted',
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={eager && !priority ? 'eager' : undefined}
          className="object-cover"
        />
      ) : (
        /*
         * `aria-hidden` porque o codigo ja aparece escrito logo abaixo, na
         * legenda: sem isso o leitor de tela leria o mesmo codigo duas vezes
         * por carta, e uma grade de 24 viraria 48 leituras.
         */
        <span
          aria-hidden
          className="flex size-full items-center justify-center px-1 text-center text-[10px] text-text-subtle"
        >
          {fallback}
        </span>
      )}
    </span>
  )
}
