import Link from 'next/link'
import { CardArt } from '@/components/catalog/card-art'
import { cn } from '@/lib/cn'

/**
 * A arte de uma carta levando à página dela no catálogo.
 *
 * Nasceu dentro do Deck Builder em 11/11, a pedido do dono do produto, e saiu
 * de lá quando a mesma coisa foi pedida para o Início, o Trade Binder de alguém
 * e a negociação de uma troca: cinco cópias do mesmo link divergiriam no
 * primeiro ajuste de foco ou de rótulo.
 *
 * ## Onde é link direto, e onde não é
 *
 * Direto onde a arte **não tinha gesto nenhum** — tocar nela não fazia nada.
 * Onde tocar já abre um painel (Minha Coleção, want list, cartas de um binder),
 * o caminho para o catálogo é o link **dentro** do painel: um link na arte
 * tiraria da pessoa o gesto que ela já aprendeu. É por isso que este componente
 * não aparece nessas telas, e aquelas não ganharam um link na imagem.
 *
 * Também fica fora de dois lugares, de propósito:
 *
 * - **A prévia da rede** (`/social`), onde cada carta já leva ao Trade Binder
 *   de quem a oferece. Ali o olho está na pessoa, e não na carta.
 * - **O Trade Binder público** (`/trade/<token>`), que é a única página sem
 *   sessão. O catálogo pede login, e a arte levaria quem recebeu o link para
 *   uma tela de entrar.
 *
 * ## O nome fica no link, e a imagem não repete
 *
 * `alt` vazio, sempre: o código e o nome já aparecem escritos junto da arte em
 * todas as telas que usam isto, e com os dois o leitor de tela anunciaria a
 * mesma carta duas vezes por item — numa decklist, 102 leituras onde bastam 51.
 * Quem nomeia o destino é o `aria-label`.
 */
export function CardArtLink({
  variantId,
  code,
  imageUrl,
  className,
  sizes,
  priority = false,
  children,
}: {
  variantId: string
  code: string
  imageUrl: string | null
  /** As classes que o `span` daquela linha ou célula tinha antes. */
  className?: string
  sizes: string
  priority?: boolean
  /**
   * O que fica **sobre** a arte, como o selo de quantidade das grades.
   *
   * Entra dentro do link porque é dentro dele que está posicionado: tocar no
   * selo abre a carta, que é o que quem tocou ali queria. Quem usa isto precisa
   * de `relative` no `className`, como no `span` que havia antes.
   */
  children?: React.ReactNode
}) {
  return (
    <Link
      href={`/catalogo/carta/${variantId}`}
      aria-label={`Ver ${code} no catálogo`}
      className={cn(
        'block shrink-0 rounded-card',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink',
        className,
      )}
    >
      <CardArt src={imageUrl} alt="" fallback={code} sizes={sizes} priority={priority} />
      {children}
    </Link>
  )
}
