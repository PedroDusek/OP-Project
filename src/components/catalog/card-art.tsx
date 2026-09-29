import Image from 'next/image'
import { storedImageFromOrigin } from '@/server/domain/catalog/stored-image'
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
  /*
   * A arte guardada por nós, quando existe (decisão 113).
   *
   * A troca acontece aqui, e não nos pontos que montam `imageUrl`, porque o
   * `source_id` está dentro do próprio endereço de origem — dá para chegar nele
   * sem mexer nas dezenas de telas que passam a imagem adiante. Endereço que não
   * reconhecemos segue para a origem, como antes.
   */
  const guardada = storedImageFromOrigin(src)
  const endereco = guardada ?? src

  return (
    <span
      className={cn(
        'relative block aspect-[5/7] w-full overflow-hidden rounded-card',
        'border border-border bg-surface-muted',
        className,
      )}
    >
      {endereco ? (
        <Image
          src={endereco}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={eager && !priority ? 'eager' : undefined}
          /*
           * A nossa já vem convertida e no tamanho: passar pelo otimizador de
           * novo seria reprocessar o que já está pronto, e devolver o `sharp` à
           * disputa pelo núcleo da máquina.
           */
          unoptimized={guardada !== null}
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
