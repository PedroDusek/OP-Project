import { Prisma, type PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { isPremium } from '@/server/application/authorization'
import { readVisibleTradeStock, type VisibleTradeCard } from '@/server/application/trades/trade-stock'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import {
  clampNetworkPage,
  NETWORK_MAX_PAGES,
  NETWORK_PAGE_SIZE,
  normalizeNetworkQuery,
  normalizeReportReason,
  previewCards,
} from '@/server/domain/social/network'
import { reportEmail } from '@/server/domain/social/report-email'
import { normalizeUsername } from '@/server/domain/social/username'
import { remainingToGet } from '@/server/domain/wants/status'
import {
  consumeRateLimit,
  NETWORK_READ_LIMIT,
  NETWORK_REPORT_LIMIT,
  NETWORK_SEARCH_LIMIT,
} from '@/server/http/rate-limit'
import type { Mailer } from '@/server/http/mailer'

/**
 * A rede: quem tem cartas para troca, e o Trade Binder de cada um (regras 6.1.2 a
 * 6.1.4, decisões 060 e 079).
 *
 * Camada: application.
 *
 * ## O que outra pessoa vê
 *
 * O nome de usuário e o Trade Binder — e nada mais. A want list nunca aparece: ela
 * só entra do lado de **quem olha**, para dizer quais cartas dos outros
 * interessam a ele. O estoque vem de `readVisibleTradeStock`, o mesmo do link
 * público, que é onde a regra 6.1 é garantida.
 *
 * ## Quem aparece
 *
 * Quem tem nome de usuário, não saiu da conta, tem ao menos uma cópia em local de
 * troca, não é quem olha e **não foi bloqueado por quem olha**. O bloqueio é numa
 * direção só, como a regra 6.1.4 escreve.
 *
 * ## Sessão e cotas
 *
 * Todo caso de uso aqui recebe o usuário autenticado: a rede exige sessão (060).
 * A listagem, a busca e a denúncia têm cotas próprias por pessoa.
 */

export interface NetworkMember {
  username: string
  premium: boolean
  /** Quantas cartas diferentes ela tem para troca. */
  cards: number
  /** Quantas dessas quem olha ainda procura. */
  interest: number
  preview: (VisibleTradeCard & { wanted: boolean; matching: boolean })[]
}

export interface NetworkPage {
  members: NetworkMember[]
  /** A página mostrada: cada página traz só as pessoas dela (decisão 084). */
  page: number
  /** Há página seguinte, dentro do teto. */
  hasMore: boolean
  /** A busca normalizada, ou `null` sem busca. */
  query: string | null
  /**
   * Com busca sem resultado, se quem olha tem a carta no próprio Trade Binder. Ele não aparece
   * para si mesmo, e sem isto a tela diria "ninguém tem" de uma carta que é dele.
   */
  viewerHasMatch: boolean
}

/** As variantes que quem olha ainda procura: o want que a coleção dele não cobre. */
async function stillWanted(prisma: PrismaClient, viewer: AuthenticatedUser): Promise<Set<string>> {
  const [wants, owned] = await Promise.all([
    prisma.wantItem.findMany({ where: { userId: viewer.id }, select: { cardVariantId: true, quantity: true } }),
    prisma.collectionItem.findMany({
      where: { collection: { userId: viewer.id } },
      select: { cardVariantId: true, quantity: true },
    }),
  ])
  const tenho = new Map(owned.map((item) => [String(item.cardVariantId), item.quantity]))
  return new Set(
    wants
      .filter((want) => remainingToGet(tenho.get(String(want.cardVariantId)) ?? 0, want.quantity) > 0)
      .map((want) => String(want.cardVariantId)),
  )
}

/**
 * O pedaço de nome de usuário que a busca procura, já pronto para `LIKE`, ou
 * `null` quando o texto não pode ser nome nenhum (espaço, acento).
 *
 * Os nomes são guardados em minúsculas, só com letras, números, ponto e
 * sublinhado (decisão 060). O sublinhado é curinga no `LIKE`, e é escapado.
 */
function usernameFragment(query: string): string | null {
  const texto = query.replace(/^@/, '').toLowerCase()
  if (!/^[a-z0-9._]+$/.test(texto)) return null
  return texto.replace(/[!%_]/g, (c) => `!${c}`)
}

/** As variantes cujo código ou nome casam com a busca. */
async function matchingVariants(prisma: PrismaClient, query: string): Promise<Set<string>> {
  const variants = await prisma.cardVariant.findMany({
    where: {
      card: {
        OR: [{ code: { contains: query, mode: 'insensitive' } }, { name: { contains: query, mode: 'insensitive' } }],
      },
    },
    select: { id: true },
    take: 2000,
  })
  return new Set(variants.map((variant) => String(variant.id)))
}

/**
 * A listagem da rede, até a página pedida.
 *
 * Uma página por vez, sete pessoas cada (decisão 084): a tela passa de página em
 * página, e nunca carrega a rede acumulada. O teto de páginas é o da decisão 060.
 *
 * Com busca, entra quem tem alguma carta que casa **ou** cujo nome na rede
 * contém o texto (decisão 082) — e a prévia mostra primeiro as cartas que casam.
 * Começando por `@`, a busca é só por nome. O nome igual ao buscado vem primeiro:
 * quem digita um nome inteiro procura aquela pessoa.
 */
export async function listNetwork(
  prisma: PrismaClient,
  viewer: AuthenticatedUser,
  options: { page?: string | number | null; query?: string | null } = {},
  now: Date = new Date(),
): Promise<NetworkPage> {
  const page = clampNetworkPage(options.page)
  const query = normalizeNetworkQuery(options.query)
  consumeRateLimit(`rede:${query ? 'busca' : 'lista'}:${viewer.id}`, query ? NETWORK_SEARCH_LIMIT : NETWORK_READ_LIMIT)

  const wanted = await stillWanted(prisma, viewer)
  const nome = query ? usernameFragment(query) : null
  const soNome = query?.startsWith('@') ?? false
  const matching = query && !soNome ? await matchingVariants(prisma, query) : null

  const quero = [...wanted]
  const casa = matching ? [...matching] : []
  const inicio = (page - 1) * NETWORK_PAGE_SIZE

  const porCarta = casa.length > 0 ? Prisma.sql`COUNT(*) FILTER (WHERE ci.card_variant_id::text = ANY(${casa}::text[])) > 0` : null
  const porNome = nome ? Prisma.sql`u.username LIKE ${`%${nome}%`} ESCAPE '!'` : null
  const filtro = !query
    ? Prisma.sql`TRUE`
    : porCarta && porNome
      ? Prisma.sql`(${porCarta} OR ${porNome})`
      : (porCarta ?? porNome ?? Prisma.sql`FALSE`)
  const nomeIgual = nome ? Prisma.sql`(u.username = ${nome.replace(/!(.)/g, '$1')}) DESC,` : Prisma.empty

  // Premium primeiro, depois o interesse, depois o nome (regra 6.1.3). A mesma
  // ordem de `compareNetworkMembers`, feita no banco para paginar sem trazer a
  // rede inteira para a memoria.
  const rows = await prisma.$queryRaw<
    { id: bigint; username: string; plan: string; premium_until: Date | null; cards: bigint; interest: bigint }[]
  >(Prisma.sql`
    SELECT u.id, u.username, u.plan, u.premium_until,
           COUNT(DISTINCT ci.card_variant_id) AS cards,
           COUNT(DISTINCT ci.card_variant_id) FILTER (WHERE ci.card_variant_id::text = ANY(${quero}::text[])) AS interest
      FROM users u
      JOIN storage_locations sl ON sl.user_id = u.id AND sl.purpose = 'TRADE'
      JOIN collection_item_locations cil ON cil.storage_location_id = sl.id AND cil.quantity > 0
      JOIN collection_items ci ON ci.id = cil.collection_item_id
      JOIN collections c ON c.id = ci.collection_id AND c.user_id = u.id
     WHERE u.username IS NOT NULL
       AND u.deleted_at IS NULL
       AND u.deletion_requested_at IS NULL
       AND u.id <> ${viewer.id}
       AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = ${viewer.id} AND b.blocked_id = u.id)
     GROUP BY u.id
    HAVING ${filtro}
     ORDER BY ${nomeIgual}
              (u.plan = 'PREMIUM' AND (u.premium_until IS NULL OR u.premium_until > ${now})) DESC,
              interest DESC,
              u.username ASC
     LIMIT ${NETWORK_PAGE_SIZE + 1} OFFSET ${inicio}
  `)

  const hasMore = rows.length > NETWORK_PAGE_SIZE && page < NETWORK_MAX_PAGES
  const pagina = rows.slice(0, NETWORK_PAGE_SIZE)
  const estoque = await readVisibleTradeStock(
    prisma,
    pagina.map((row) => row.id),
  )

  const members = pagina.map((row) => {
    const cartas = estoque.get(row.id) ?? []
    return {
      username: row.username,
      premium: isPremium({ plan: row.plan, premiumUntil: row.premium_until }, now),
      cards: Number(row.cards),
      interest: Number(row.interest),
      preview: previewCards(cartas, { wanted, matching: matching ?? undefined }).map((card) => ({
        ...card,
        wanted: wanted.has(card.variantId),
        matching: matching?.has(card.variantId) ?? false,
      })),
    }
  })

  let viewerHasMatch = false
  if (matching && members.length === 0) {
    const meu = (await readVisibleTradeStock(prisma, [viewer.id])).get(viewer.id) ?? []
    viewerHasMatch = meu.some((card) => matching.has(card.variantId))
  }

  return { members, page, hasMore, query, viewerHasMatch }
}

export interface MemberBinder {
  username: string
  premium: boolean
  /** Quem olha bloqueou esta pessoa: a tela não mostra as cartas, e oferece desbloquear. */
  blocked: boolean
  cards: (VisibleTradeCard & { wanted: boolean })[]
  copies: number
  /** Quantas cartas diferentes quem olha ainda procura aqui. */
  interest: number
}

async function findMember(prisma: PrismaClient, username: string) {
  const nome = normalizeUsername(username)
  const pessoa = await prisma.user.findUnique({
    where: { username: nome },
    select: { id: true, username: true, plan: true, premiumUntil: true, deletedAt: true, deletionRequestedAt: true },
  })
  // Conta que saiu, conta com exclusao pedida (decisao 091) e nome que nao
  // existe sao a mesma resposta.
  if (!pessoa || pessoa.deletedAt || pessoa.deletionRequestedAt || !pessoa.username) {
    throw new NotFoundError('Ninguém na rede tem esse nome.')
  }
  return { ...pessoa, username: pessoa.username }
}

/**
 * O Trade Binder de alguém, visto de dentro da rede.
 *
 * Diferente do link público: aqui quem olha tem sessão, e as cartas que ele
 * procura vêm marcadas. O próprio nome devolve `null` — a tela manda para o
 * Trade Binder de quem olha, onde ele edita.
 */
export async function readMemberBinder(
  prisma: PrismaClient,
  viewer: AuthenticatedUser,
  username: string,
  now: Date = new Date(),
): Promise<MemberBinder | null> {
  consumeRateLimit(`rede:lista:${viewer.id}`, NETWORK_READ_LIMIT)
  const pessoa = await findMember(prisma, username)
  if (pessoa.id === viewer.id) return null

  const bloqueio = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: pessoa.id } },
    select: { id: true },
  })
  const premium = isPremium({ plan: pessoa.plan, premiumUntil: pessoa.premiumUntil }, now)

  if (bloqueio) {
    return { username: pessoa.username, premium, blocked: true, cards: [], copies: 0, interest: 0 }
  }

  const [estoque, wanted] = await Promise.all([
    readVisibleTradeStock(prisma, [pessoa.id]),
    stillWanted(prisma, viewer),
  ])
  const cards = (estoque.get(pessoa.id) ?? []).map((card) => ({ ...card, wanted: wanted.has(card.variantId) }))

  return {
    username: pessoa.username,
    premium,
    blocked: false,
    cards,
    copies: cards.reduce((total, card) => total + card.quantity, 0),
    interest: cards.filter((card) => card.wanted).length,
  }
}

async function targetOf(prisma: PrismaClient, viewer: AuthenticatedUser, username: string, gesto: string) {
  const pessoa = await findMember(prisma, username)
  if (pessoa.id === viewer.id) throw new ValidationError(`Você não pode ${gesto} a si mesmo.`)
  return pessoa
}

/** Bloqueia. Bloquear de novo quem já está bloqueado não é erro. */
export async function blockMember(prisma: PrismaClient, viewer: AuthenticatedUser, username: string): Promise<void> {
  const pessoa = await targetOf(prisma, viewer, username, 'bloquear')
  await prisma.userBlock.createMany({
    data: [{ blockerId: viewer.id, blockedId: pessoa.id }],
    skipDuplicates: true,
  })
}

/** Desbloqueia. Desbloquear quem não está bloqueado não é erro. */
export async function unblockMember(prisma: PrismaClient, viewer: AuthenticatedUser, username: string): Promise<void> {
  const pessoa = await findMember(prisma, username)
  await prisma.userBlock.deleteMany({ where: { blockerId: viewer.id, blockedId: pessoa.id } })
}

export interface BlockedMember {
  username: string
  since: Date
}

/** A lista de bloqueados, para as configurações da conta (regra 6.1.4). */
export async function listBlockedMembers(prisma: PrismaClient, viewer: AuthenticatedUser): Promise<BlockedMember[]> {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId: viewer.id },
    select: { createdAt: true, blocked: { select: { username: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return rows
    .filter((row) => row.blocked.username)
    .map((row) => ({ username: row.blocked.username!, since: row.createdAt }))
}

/**
 * Denuncia. O motivo é obrigatório; quem vai ler precisa saber o que aconteceu.
 *
 * Grava, e depois avisa o suporte por e-mail (decisões 086 e 087). O e-mail é onde
 * a denúncia é lida; o banco guarda o registro. Se o envio falhar ou o provedor
 * não estiver configurado, a denúncia continua gravada, e quem denunciou não vê
 * erro de uma coisa que não é dela — a falha fica no log, com o número.
 */
export async function reportMember(
  prisma: PrismaClient,
  mailer: Mailer,
  viewer: AuthenticatedUser,
  username: string,
  rawReason: string,
): Promise<void> {
  const reason = normalizeReportReason(rawReason)
  const pessoa = await targetOf(prisma, viewer, username, 'denunciar')
  consumeRateLimit(`rede:denuncia:${viewer.id}`, NETWORK_REPORT_LIMIT)
  const denuncia = await prisma.userReport.create({
    data: { reporterId: viewer.id, reportedId: pessoa.id, reason },
    select: {
      id: true,
      createdAt: true,
      reporter: { select: { username: true, email: true } },
      reported: { select: { email: true } },
    },
  })

  if (!mailer.available) return
  try {
    await mailer.send(
      reportEmail({
        reportId: denuncia.id,
        createdAt: denuncia.createdAt,
        reporter: denuncia.reporter,
        reported: { username: pessoa.username, email: denuncia.reported.email },
        reason,
      }),
    )
  } catch (error) {
    // Sem o motivo nem os e-mails no log: só o que permite achar a denúncia.
    console.error('[denuncia] e-mail ao suporte falhou', {
      reportId: String(denuncia.id),
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
