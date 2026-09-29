import type { PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/server/application/auth'
import { assertPremium } from '@/server/application/authorization'
import { getUsdBrlRate } from '@/server/application/prices/read-prices'
import {
  assertDeckRules,
  deckTotal,
  distributeOwned,
  fitsLeader,
  type DeckLine,
} from '@/server/domain/decks/deck'
import { NotFoundError, ValidationError } from '@/server/domain/errors'

/**
 * A conferência de um deck (decisão 095).
 *
 * Camada: application.
 *
 * **Nada é guardado.** A pessoa monta a lista na tela, e isto responde três
 * coisas: quantas cópias ela já tem, **onde** elas estão, e quanto custa o que
 * falta. Escolha do dono do produto — o ColeXa confere decks, não os hospeda.
 *
 * O preço do que falta é o da **arte escolhida**: quem montou a lista escolheu
 * aquela arte, e trocar por outra na conta seria responder outra pergunta.
 */

export interface DeckInput {
  leaderVariantId: string
  lines: readonly { variantId: string; copies: number }[]
  /** Ligado, as cópias de qualquer arte da mesma carta contam. */
  autoComplete: boolean
}

export interface DeckPlace {
  /** O nome do móvel, ou `null` para as cópias sem local definido. */
  location: string | null
  /** O local é de troca: a carta está oferecida a outras pessoas (regra 4.2). */
  forTrade: boolean
  quantity: number
  /** A arte das cópias neste lugar: com o auto completar, pode não ser a escolhida. */
  variantType: string
  /** Estas cópias são de outra arte da mesma carta. */
  otherArt: boolean
}

export interface DeckAnalysisLine {
  variantId: string
  cardCode: string
  cardName: string
  variantType: string
  imageUrl: string | null
  copies: number
  owned: number
  missing: number
  /**
   * Quantas das cópias que contaram são de **outra arte** — só acontece com o
   * auto completar ligado. A tela avisa, porque quem montou pediu uma arte e
   * vai jogar com outra (relatado pelo dono do produto).
   */
  fromOtherArt: number
  /** Onde estão as cópias que contaram, incluindo as sem local definido. */
  places: DeckPlace[]
  /** Preço unitário da arte escolhida, em dólar, ou `null` sem preço conhecido. */
  unitUsd: number | null
  /** Custo das cópias que faltam desta linha. */
  missingUsd: number | null
}

export interface DeckAnalysis {
  /**
   * O líder, conferido como qualquer carta (pedido do dono do produto: a
   * conferência olha as 51 cartas). As cores ficam aqui porque filtram o resto.
   */
  leader: DeckAnalysisLine & { colors: string[] }
  autoComplete: boolean
  /** Cartas conferidas: o líder mais as do deck. */
  total: number
  remaining: number
  ownedTotal: number
  missingTotal: number
  cost: {
    usd: number
    brl: { value: number; rate: number } | null
    /** Quantas cópias faltantes não entraram na conta por não ter preço. */
    withoutPrice: number
  }
  lines: DeckAnalysisLine[]
}

export async function analyzeDeck(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  input: DeckInput,
  now: Date = new Date(),
): Promise<DeckAnalysis> {
  assertPremium(user, 'As decklists são um recurso Premium.')

  if (input.lines.length === 0) throw new ValidationError('Escolha ao menos uma carta para conferir.')

  const { leader, lines, escolhidas } = await conferirLista(prisma, input)

  /*
   * O líder é conferido junto (pedido do dono do produto: são 51 cartas). Ele
   * entra como a primeira linha na hora de repartir o que a pessoa tem, e fica
   * fora das regras das 50 — cor, quatro cópias e total —, que já foram
   * conferidas acima só com as cartas do deck. O código dele nunca é o de uma
   * carta do deck, então repartir junto não rouba cópia de ninguém.
   */
  const linhaDoLider: DeckLine = { variantId: input.leaderVariantId, cardCode: leader.cardCode, copies: 1 }
  const conferidas = [linhaDoLider, ...lines]

  const posse = await posseDe(prisma, user, conferidas.map((line) => line.cardCode))
  const ownedByVariant = new Map([...posse].map(([variantId, dados]) => [variantId, dados.quantity]))
  const ownedByCode = new Map<string, number>()
  for (const dados of posse.values()) {
    ownedByCode.set(dados.cardCode, (ownedByCode.get(dados.cardCode) ?? 0) + dados.quantity)
  }

  const reparte = distributeOwned(conferidas, ownedByVariant, ownedByCode, input.autoComplete)
  const precos = await precosDe(prisma, conferidas.map((line) => line.variantId))

  const todas: DeckAnalysisLine[] = conferidas.map((line, i) => {
    const variante = escolhidas.get(line.variantId)!
    const unitUsd = precos.get(line.variantId) ?? null
    const { owned, missing } = reparte[i]

    return {
      variantId: line.variantId,
      cardCode: line.cardCode,
      cardName: variante.cardName,
      variantType: variante.variantType,
      imageUrl: variante.imageUrl,
      copies: line.copies,
      owned,
      missing,
      // A arte escolhida cobre primeiro; o resto do que contou veio de outra.
      fromOtherArt: Math.max(0, owned - Math.min(owned, ownedByVariant.get(line.variantId) ?? 0)),
      places: lugaresDe(posse, line, input.autoComplete),
      unitUsd,
      missingUsd: unitUsd === null ? null : Number((unitUsd * missing).toFixed(2)),
    }
  })

  const [liderConferido, ...analisadas] = todas
  const semPreco = todas
    .filter((line) => line.unitUsd === null)
    .reduce((soma, line) => soma + line.missing, 0)
  const usd = Number(todas.reduce((soma, line) => soma + (line.missingUsd ?? 0), 0).toFixed(2))
  const rate = await getUsdBrlRate(prisma, now)

  return {
    leader: { ...liderConferido, colors: leader.colors },
    autoComplete: input.autoComplete,
    total: deckTotal(lines) + 1,
    remaining: Math.max(0, 50 - deckTotal(lines)),
    ownedTotal: todas.reduce((soma, line) => soma + line.owned, 0),
    missingTotal: todas.reduce((soma, line) => soma + line.missing, 0),
    cost: {
      usd,
      brl: rate ? { value: Number((usd * rate.rate).toFixed(2)), rate: rate.rate } : null,
      withoutPrice: semPreco,
    },
    lines: analisadas,
  }
}

interface VarianteEscolhida {
  cardCode: string
  cardName: string
  cardType: string
  variantType: string
  imageUrl: string | null
  colors: string[]
}

/**
 * As regras do deck, conferidas contra o catálogo.
 *
 * Exportada porque **salvar e conferir exigem o mesmo**: um líder de verdade,
 * cartas na cor dele, no máximo quatro cópias por código e no máximo cinquenta
 * cartas. Duplicar isso no salvamento criaria dois lugares para a mesma regra —
 * e o dia em que divergissem, a lista salva aceitaria o que a conferência
 * recusa (decisão 108).
 */
export async function conferirLista(
  prisma: PrismaClient,
  input: DeckInput,
): Promise<{ leader: VarianteEscolhida; lines: DeckLine[]; escolhidas: Map<string, VarianteEscolhida> }> {
  const escolhidas = await variantesDe(prisma, [
    input.leaderVariantId,
    ...input.lines.map((line) => line.variantId),
  ])

  const leader = escolhidas.get(input.leaderVariantId)
  if (!leader) throw new NotFoundError('Líder não encontrado.')
  if (leader.cardType !== 'Leader') throw new ValidationError('O líder precisa ser uma carta de Leader.')

  const lines: DeckLine[] = input.lines.map((line) => {
    const variante = escolhidas.get(line.variantId)
    if (!variante) throw new NotFoundError('Alguma carta da lista não existe mais.')
    if (variante.cardType === 'Leader') {
      throw new ValidationError(`${variante.cardCode} é um Leader: o deck tem um líder só.`)
    }
    if (!fitsLeader(leader.colors, variante.colors)) {
      throw new ValidationError(
        `${variante.cardCode} não tem a cor do líder (${leader.colors.join(' e ')}).`,
      )
    }
    return { variantId: line.variantId, cardCode: variante.cardCode, copies: line.copies }
  })

  assertDeckRules(lines)
  return { leader, lines, escolhidas }
}

async function variantesDe(prisma: PrismaClient, ids: string[]): Promise<Map<string, VarianteEscolhida>> {
  const unicos = [...new Set(ids)].filter((id) => /^\d+$/.test(id))
  if (unicos.length === 0) throw new ValidationError('Lista inválida.')

  const variantes = await prisma.cardVariant.findMany({
    where: { id: { in: unicos.map(BigInt) } },
    select: {
      id: true,
      variantType: true,
      imageUrl: true,
      card: {
        select: { code: true, name: true, type: true, colors: { select: { color: { select: { name: true } } } } },
      },
    },
  })

  return new Map(
    variantes.map((variante) => [
      String(variante.id),
      {
        cardCode: variante.card.code,
        cardName: variante.card.name,
        cardType: variante.card.type,
        variantType: variante.variantType,
        imageUrl: variante.imageUrl,
        colors: variante.card.colors.map((c) => c.color.name),
      },
    ]),
  )
}

interface PosseDaVariante {
  cardCode: string
  variantType: string
  quantity: number
  places: Omit<DeckPlace, 'otherArt'>[]
}

/**
 * O que a pessoa tem das cartas da lista, por variante, com os lugares.
 *
 * Busca por **código**, e não pelas variantes escolhidas, porque o auto completar
 * precisa das outras artes — e porque mesmo desligado a tela diz quantas cópias
 * de outras artes existem.
 *
 * As cópias sem local entram como lugar de nome nulo: elas contam (escolha do
 * dono do produto), e a tela avisa que falta dizer onde estão.
 */
async function posseDe(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  codes: string[],
): Promise<Map<string, PosseDaVariante>> {
  const itens = await prisma.collectionItem.findMany({
    where: {
      collection: { userId: user.id },
      quantity: { gt: 0 },
      cardVariant: { card: { code: { in: [...new Set(codes)] } } },
    },
    select: {
      quantity: true,
      cardVariantId: true,
      cardVariant: { select: { variantType: true, card: { select: { code: true } } } },
      locations: {
        where: { quantity: { gt: 0 } },
        select: { quantity: true, storageLocation: { select: { name: true, purpose: true } } },
      },
    },
  })

  return new Map(
    itens.map((item) => {
      const alocado = item.locations.reduce((soma, local) => soma + local.quantity, 0)
      const variantType = item.cardVariant.variantType
      const places: Omit<DeckPlace, 'otherArt'>[] = item.locations.map((local) => ({
        location: local.storageLocation.name,
        forTrade: local.storageLocation.purpose === 'TRADE',
        quantity: local.quantity,
        variantType,
      }))
      if (item.quantity > alocado) {
        places.push({ location: null, forTrade: false, quantity: item.quantity - alocado, variantType })
      }
      return [
        String(item.cardVariantId),
        { cardCode: item.cardVariant.card.code, variantType, quantity: item.quantity, places },
      ]
    }),
  )
}

/** Os lugares que a linha considera: só a arte escolhida, ou todas as do código. */
function lugaresDe(
  posse: Map<string, PosseDaVariante>,
  line: DeckLine,
  autoComplete: boolean,
): DeckPlace[] {
  const relevantes = [...posse.entries()].filter(([variantId, dados]) =>
    autoComplete ? dados.cardCode === line.cardCode : variantId === line.variantId,
  )

  // Agrupa por lugar **e arte**: duas artes no mesmo binder sao dois avisos,
  // porque a tela precisa dizer qual das copias e de outra arte.
  const somados = new Map<string, DeckPlace>()
  for (const [variantId, dados] of relevantes) {
    for (const place of dados.places) {
      const chave = `${place.location ?? ''}|${place.forTrade}|${variantId}`
      const atual = somados.get(chave)
      if (atual) atual.quantity += place.quantity
      else somados.set(chave, { ...place, otherArt: variantId !== line.variantId })
    }
  }
  return [...somados.values()].sort((a, b) => b.quantity - a.quantity)
}

/** O preço mais recente de cada arte escolhida, em dólar. */
async function precosDe(prisma: PrismaClient, variantIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(variantIds)].map(BigInt)
  if (ids.length === 0) return new Map()

  // Uma consulta so: uma por carta seriam cinquenta idas ao banco por
  // conferencia. Era um `DISTINCT ON` sobre a serie historica; desde a decisao
  // 107 ha uma linha por variante, e desempatar por data saiu de cena.
  const rows = await prisma.cardPrice.findMany({
    where: { cardVariantId: { in: ids } },
    select: { cardVariantId: true, value: true },
  })
  return new Map(rows.map((row) => [String(row.cardVariantId), Number(row.value)]))
}
