import { House, Layers, Search, ArrowLeftRight, Ellipsis, BookOpen } from 'lucide-react'

/**
 * Os cinco destinos da navegacao principal.
 *
 * Ficam num arquivo so porque a barra inferior, a coluna lateral e o menu
 * "Mais" precisam da mesma lista: com tres copias, um destino novo entraria em
 * duas e sumiria da terceira.
 *
 * ## Por que Binders entrou e Trocas saiu
 *
 * Binders e onde se cria e edita binder, caixa e deck. Estava dentro de "Mais",
 * uma gaveta de configuracao — e criar coisa nao e configurar. Uma secao em que
 * se cria conteudo o dia inteiro precisa estar na barra.
 *
 * A barra continua com **cinco**. Seis alvos a 360 px dao 60 px cada, abaixo do
 * confortavel para o polegar; escolha do dono do produto, Trocas espera dentro
 * de "Mais" ate o checkpoint que a constroi. Ela continua aparecendo la, com a
 * mesma descricao, e volta para a barra quando existir de verdade.
 *
 * As rotas estao em portugues, como o dominio e a documentacao do projeto.
 * `binders` e a excecao porque e a palavra que quem joga usa.
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
    href: '/binders',
    label: 'Binders',
    icon: BookOpen,
    description: 'Seus binders, caixas e decks: criar, editar e ver o que está em cada um.',
  },
  {
    href: '/mais',
    label: 'Mais',
    icon: Ellipsis,
    description: 'Trocas, perfil, Premium e configurações.',
  },
]

/**
 * Destinos que existem, mas nao cabem na barra hoje.
 *
 * Aparecem so no menu "Mais". Estao aqui, e nao soltos naquela pagina, para
 * `activeDestination` continuar reconhecendo a rota — sem isso, quem entra em
 * `/trocas` nao ve nenhum item marcado na navegacao.
 */
export const SECONDARY_DESTINATIONS: Destination[] = [
  {
    href: '/trocas',
    label: 'Trocas',
    icon: ArrowLeftRight,
    description: 'Want list, Trade Binder, matches e negociações.',
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
  return [...DESTINATIONS, ...SECONDARY_DESTINATIONS].find(
    (destination) =>
      pathname === destination.href || pathname.startsWith(`${destination.href}/`),
  )
}
