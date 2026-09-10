import {
  ArrowLeftRight,
  BookOpen,
  Heart,
  House,
  Layers,
  Search,
  UserRound,
  Users,
} from 'lucide-react'

/**
 * Os destinos da navegacao.
 *
 * Ficam num arquivo so porque a gaveta do celular e a coluna do desktop pedem a
 * mesma lista: com duas copias, um destino novo entraria numa e sumiria da
 * outra.
 *
 * ## Por que nao ha mais um teto de cinco
 *
 * A barra inferior tinha cinco lugares porque seis alvos a 360 px dao 60 px
 * cada, abaixo do confortavel para o polegar. Esse teto vinha da **barra**, e
 * nao do produto: numa gaveta que abre, cada linha tem a altura inteira de uma
 * lista, e cabem quantas forem precisas.
 *
 * Com a gaveta, Trocas voltou para a navegacao e Want list e Social entraram —
 * escolha do dono do produto, que muda a decisao 044.
 *
 * ## A conta fica separada
 *
 * `DESTINATIONS` sao lugares onde se **faz** coisa: colecao, catalogo, binders,
 * trocas. A conta e onde se ve quem voce e e se ajusta o produto, e misturar as
 * duas naturezas na mesma lista faz a pessoa procurar configuracao no meio de
 * conteudo.
 *
 * As rotas estao em portugues, como o dominio e a documentacao do projeto.
 * `binders` e a excecao porque e a palavra que quem joga usa.
 */

export interface Destination {
  href: string
  label: string
  icon: React.ElementType
  /** O que a secao faz. Usado na gaveta e no estado vazio das telas. */
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
    href: '/quero',
    label: 'Want list',
    icon: Heart,
    description: 'As cartas que você procura, para levar ao grupo em imagem ou papel.',
  },
  {
    href: '/trocas',
    label: 'Trocas',
    icon: ArrowLeftRight,
    description: 'Seu Trade Binder e as negociações em andamento.',
  },
  {
    href: '/social',
    label: 'Social',
    icon: Users,
    description: 'Quem tem o que você procura, e quem procura o que você tem.',
  },
]

/**
 * A conta. Fora de `DESTINATIONS` de proposito — ver o comentario acima.
 */
export const ACCOUNT: Destination = {
  href: '/conta',
  label: 'Minha conta',
  icon: UserRound,
  description: 'Seus dados, seu nome na rede e as preferências do aplicativo.',
}

/**
 * O destino que corresponde a uma rota.
 *
 * Casa por prefixo para que `/catalogo/OP01` continue marcando "Catálogo" como
 * ativo. Comparar por igualdade deixaria a navegacao sem nenhum item ativo
 * assim que a pessoa entrasse em qualquer detalhe.
 *
 * O mais longo vence, e isso importa quando um destino for prefixo de outro:
 * sem ordenar, `/colecao` casaria antes de `/colecao/algo` e o item errado
 * ficaria marcado.
 */
export function activeDestination(pathname: string): Destination | undefined {
  return [...DESTINATIONS, ACCOUNT]
    .filter((destination) => pathname === destination.href || pathname.startsWith(`${destination.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]
}
