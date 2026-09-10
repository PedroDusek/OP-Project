import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { ConflictError } from '@/server/domain/errors'
import { compareSetsForCatalog } from '@/server/domain/catalog/sets'

/**
 * O Trade Binder publicado por link.
 *
 * Camada: application.
 *
 * ## O que se publica é o conjunto, não o móvel
 *
 * Todas as cópias em locais de finalidade `TRADE` aparecem como **uma coleção
 * só**. A divisão entre binder e caixa é organização doméstica de quem guarda, e
 * não diz nada a quem abre o link procurando uma carta (decisão 064).
 *
 * Por isso o token é da pessoa, e não do local. Isto **altera a decisão 008**,
 * que o guardava em `storage_locations`.
 *
 * ## O que a página pública expõe, e o que ela nunca expõe
 *
 * Expõe o **nome de usuário** e as cartas disponíveis para troca. Nada mais.
 *
 * Nunca: nome real, e-mail, a coleção, outros armazenamentos, decks, a want
 * list, ou o total possuído de cada carta. A regra 6.1 lista isso, e a 6.1.1
 * diz que o nome de usuário é a única identidade que outros veem.
 *
 * A ausência de `ownedQuantity` aqui não é esquecimento. O Trade Binder de
 * dentro do app mostra quantas a pessoa tem ao todo, para ela saber o que ficou
 * de fora; num link público isso contaria a estranhos o tamanho da coleção
 * dela, que não é o que ela publicou.
 *
 * ## Publicar é um gesto, e revogar é outro
 *
 * O link nasce ao publicar e morre ao revogar. Regerar troca o valor, o que
 * derruba o link antigo — é a saída de quem mandou para a pessoa errada.
 */

/** 24 bytes em base64url: 32 caracteres. Cabe na URL e não se adivinha. */
const TOKEN_BYTES = 24

export interface PublicBinderCard {
  variantId: string
  cardCode: string
  cardName: string
  rarity: string | null
  variantType: string
  imageUrl: string | null
  /** Cópias disponíveis para troca, somadas entre todos os locais de troca. */
  quantity: number
}

export interface PublicBinder {
  /** A única identidade que aparece (regra 6.1.1). */
  username: string
  cards: PublicBinderCard[]
  /** Quantas cópias ao todo, para a página dizer o tamanho sem recontar. */
  copies: number
  publishedAt: Date
}

export interface TradeBinderShare {
  token: string | null
  publishedAt: Date | null
}

/** Quem publica precisa de nome de usuário: é o que a página mostra. */
export const USERNAME_REQUIRED = 'NOME_DE_USUARIO_NECESSARIO'

/**
 * O estado da publicação de quem pergunta.
 *
 * Devolve o token para a tela montar o link. É dado da própria pessoa, e não
 * segredo dela para ela mesma.
 */
export async function getTradeBinderShare(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<TradeBinderShare> {
  const row = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { tradeBinderToken: true, tradeBinderTokenCreatedAt: true },
  })

  return { token: row.tradeBinderToken, publishedAt: row.tradeBinderTokenCreatedAt }
}

/**
 * Publica, ou troca o link por um novo.
 *
 * A mesma função para as duas coisas porque são o mesmo gesto do ponto de vista
 * do sistema: gravar um token novo. Publicar pela primeira vez e regerar depois
 * de mandar para a pessoa errada produzem o mesmo estado, e um caminho separado
 * para cada um daria duas formas de dizer a mesma coisa.
 */
export async function publishTradeBinder(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<TradeBinderShare> {
  const dono = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { username: true },
  })

  /*
   * Sem nome de usuario nao ha o que a pagina mostre como identidade. A regra
   * 6.1.1 diz que ele e a unica que outros veem — publicar antes de escolher
   * produziria uma pagina de ninguem.
   */
  if (!dono.username) {
    throw new ConflictError(
      USERNAME_REQUIRED,
      'Escolha um nome de usuário antes de publicar: é ele que aparece na página.',
    )
  }

  const token = randomBytes(TOKEN_BYTES).toString('base64url')
  const agora = new Date()

  await prisma.user.update({
    where: { id: user.id },
    data: { tradeBinderToken: token, tradeBinderTokenCreatedAt: agora },
  })

  return { token, publishedAt: agora }
}

/**
 * Revoga o link.
 *
 * O token vai a nulo, e a data junto — o `CHECK` do banco não aceita um sem o
 * outro. A partir daí o endereço antigo não encontra nada, que é o que revogar
 * precisa significar.
 */
export async function revokeTradeBinder(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<void> {
  await prisma.user.update({
    where: { id: user.id },
    data: { tradeBinderToken: null, tradeBinderTokenCreatedAt: null },
  })
}

/**
 * Lê um Trade Binder publicado, pelo token.
 *
 * **Não recebe usuário autenticado, de propósito**: a página é pública, e quem
 * tem o link entra. O que protege aqui é o token ser longo e aleatório, e a
 * consulta devolver exatamente o que a regra 6.1 permite.
 *
 * Devolve `null` para token que não existe — e é a mesma resposta para token
 * revogado, porque distinguir os dois contaria a quem tentasse que aquele link
 * já existiu.
 */
export async function readPublicTradeBinder(
  prisma: PrismaClient,
  token: string,
): Promise<PublicBinder | null> {
  if (token.trim() === '') return null

  const dono = await prisma.user.findUnique({
    where: { tradeBinderToken: token },
    select: {
      id: true,
      username: true,
      deletedAt: true,
      tradeBinderTokenCreatedAt: true,
    },
  })

  // Conta anonimizada nao publica nada: o token some junto na anonimizacao, e
  // esta checagem e a rede de seguranca (decisao 015).
  if (!dono || dono.deletedAt || !dono.username || !dono.tradeBinderTokenCreatedAt) {
    return null
  }

  const rows = await prisma.collectionItemLocation.findMany({
    where: {
      storageLocation: { userId: dono.id, purpose: 'TRADE' },
      collectionItem: { collection: { userId: dono.id } },
    },
    select: {
      quantity: true,
      collectionItem: {
        select: {
          cardVariant: {
            select: {
              id: true,
              variantType: true,
              rarity: true,
              imageUrl: true,
              card: { select: { code: true, name: true } },
              printings: { select: { set: { select: { code: true } } }, take: 1 },
            },
          },
        },
      },
    },
  })

  const porVariante = new Map<string, { card: PublicBinderCard; setCode: string | null }>()

  for (const row of rows) {
    const variante = row.collectionItem.cardVariant
    const chave = String(variante.id)
    const achado = porVariante.get(chave)

    // O conjunto e somado entre os locais: quem olha ve "3 copias", e nao
    // "2 no binder e 1 na caixa" (decisao 064).
    if (achado) {
      achado.card.quantity += row.quantity
      continue
    }

    porVariante.set(chave, {
      setCode: variante.printings[0]?.set.code ?? null,
      card: {
        variantId: chave,
        cardCode: variante.card.code,
        cardName: variante.card.name,
        rarity: variante.rarity,
        variantType: variante.variantType,
        imageUrl: variante.imageUrl,
        quantity: row.quantity,
      },
    })
  }

  // A mesma ordem do catalogo e da colecao — lancamento, promos no fim
  // (decisao 040) —, porque e a ordem que quem joga ja aprendeu.
  const cards = [...porVariante.values()]
    .sort((a, b) => {
      const set = compareSetsForCatalog(a.setCode, b.setCode)
      if (set !== 0) return set
      if (a.card.cardCode !== b.card.cardCode) return a.card.cardCode < b.card.cardCode ? -1 : 1
      return a.card.variantId < b.card.variantId ? -1 : 1
    })
    .map((entrada) => entrada.card)

  return {
    username: dono.username,
    cards,
    copies: cards.reduce((total, card) => total + card.quantity, 0),
    publishedAt: dono.tradeBinderTokenCreatedAt,
  }
}
