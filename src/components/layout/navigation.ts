import { House, Layers, Search, ArrowLeftRight, Ellipsis } from 'lucide-react'

/**
 * Os cinco destinos da navegacao principal.
 *
 * Sao exatamente os da secao 4 do documento oficial. Ficam num arquivo so
 * porque a barra inferior, a coluna lateral e o menu "Mais" precisam da mesma
 * lista: com tres copias, um destino novo entraria em duas e sumiria da
 * terceira.
 *
 * As rotas estao em portugues, como o dominio e a documentacao do projeto.
 */

export interface Destination {
  href: string
  label: string
  icon: React.ElementType
  /** O que a secao faz. Usado no menu "Mais" e no estado vazio das telas. */
  description: string
}

export const DESTINATIONS: Destination[] = [
  {
    href: '/inicio',
    label: 'Início',
    icon: House,
    description: 'Visão geral da coleção, progresso por set e últimas adições.',
  },
  {
    href: '/colecao',
    label: 'Coleção',
    icon: Layers,
    description: 'Suas cartas, filtros, playsets e edição de quantidade.',
  },
  {
    href: '/catalogo',
    label: 'Catálogo',
    icon: Search,
    description: 'Sets, cartas, variantes e filtros de todo o One Piece Card Game.',
  },
  {
    href: '/trocas',
    label: 'Trocas',
    icon: ArrowLeftRight,
    description: 'Want list, Trade Binder, matches e negociações.',
  },
  {
    href: '/mais',
    label: 'Mais',
    icon: Ellipsis,
    description: 'Armazenamento, perfil, Premium e configurações.',
  },
]

/**
 * O destino que corresponde a uma rota.
 *
 * Casa por prefixo para que `/catalogo/OP01` continue marcando "Catálogo" como
 * ativo. Comparar por igualdade deixaria a barra sem nenhum item ativo assim
 * que a pessoa entrasse em qualquer detalhe.
 */
export function activeDestination(pathname: string): Destination | undefined {
  return DESTINATIONS.find(
    (destination) =>
      pathname === destination.href || pathname.startsWith(`${destination.href}/`),
  )
}
