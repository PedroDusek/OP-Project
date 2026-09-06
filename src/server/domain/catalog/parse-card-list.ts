import {
  CARD_TYPES,
  KNOWN_MECHANICS,
  MECHANIC_ALIASES,
  type CardDTO,
  type CardType,
  type CatalogPage,
  type RejectedEntry,
  type SetDTO,
  type VariantDTO,
} from './types'

/**
 * Parser da listagem de cartas, HTML para DTO.
 *
 * Camada: domain. Funcao pura, sem rede e sem banco, para que toda a logica
 * fragil de extracao seja testavel com um fixture.
 *
 * Cada `<dl class="modalCol" id="...">` da pagina e uma arte, e o `id` e o
 * identificador estavel por arte da fonte. Cartas com varias artes aparecem
 * como varias entradas que compartilham o mesmo codigo.
 */

const IMAGE_BASE = 'https://en.onepiece-cardgame.com/images/cardlist/card/'

/** Remove tags e normaliza entidades e espacos. */
function text(fragment: string): string {
  return decodeEntities(fragment.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/ /g, ' ')
    .trim()
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

/** Conteudo de uma `div` de classe conhecida, ja sem o rotulo `h3`. */
function divValue(block: string, className: string): string | null {
  const match = new RegExp(
    `<div class="${className}">\\s*(?:<h3>.*?</h3>)?([\\s\\S]*?)</div>`,
    'i',
  ).exec(block)
  if (!match) return null
  const value = text(match[1])
  return value === '' ? null : value
}

/** Rotulo do `h3` de uma `div`. Leaders reusam a div "cost" com rotulo "Life". */
function divLabel(block: string, className: string): string | null {
  const match = new RegExp(`<div class="${className}"><h3>([\\s\\S]*?)</h3>`, 'i').exec(block)
  return match ? text(match[1]) : null
}

/** "-" e o vazio da fonte: nao aplica a esta carta. */
function numberOrNull(value: string | null): number | null {
  if (value === null || value === '-' || value === '') return null
  const parsed = Number.parseInt(value.replace(/[^\d-]/g, ''), 10)
  return Number.isNaN(parsed) ? null : parsed
}

function splitList(value: string | null): string[] {
  if (!value || value === '-') return []
  return value
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part !== '' && part !== '-')
}

function toCardType(raw: string): CardType | null {
  const normalised = raw.trim().toLowerCase()
  return CARD_TYPES.find((type) => type.toLowerCase() === normalised) ?? null
}

/**
 * Mecanicas presentes no texto, restritas ao vocabulario conhecido.
 * Ver KNOWN_MECHANICS para o motivo de nao aceitar todo colchete.
 */
function extractMechanics(effectText: string): string[] {
  const bracketed = new Set(
    Array.from(effectText.matchAll(/\[([^\]]+)\]/g), (match) => {
      const term = match[1].trim()
      return MECHANIC_ALIASES[term] ?? term
    }),
  )
  return KNOWN_MECHANICS.filter((mechanic) => bracketed.has(mechanic))
}

/**
 * O campo de sets traz uma linha por set, no formato "NOME [CODIGO]". Uma
 * variante reimpressa lista varias linhas, e e dali que vem variant_printings:
 * o set nunca e derivado do prefixo do codigo da carta.
 */
function parseSets(rawSets: string | null): { sets: SetDTO[]; unmapped: string[] } {
  if (!rawSets) return { sets: [], unmapped: [] }
  const sets: SetDTO[] = []
  const unmapped: string[] = []
  for (const rawLine of rawSets.split('\n')) {
    const line = rawLine.trim()
    if (line === '') continue
    const match = /^(.*?)\s*\[([^\]]+)\]\s*$/.exec(line)
    const code = match?.[2]?.trim()
    if (!code) {
      // Produtos promocionais ("Tournament Pack Vol.4") vem sem codigo. Sao
      // registrados em vez de sumirem: a variante entra no catalogo sem set, e
      // isso precisa aparecer no relatorio de importacao.
      unmapped.push(line)
      continue
    }
    const name = (match?.[1] ?? '').trim()
    sets.push({ name: name === '' ? code : name, code })
  }
  return { sets, unmapped }
}

/**
 * O sufixo "_pN" e a propria notacao da fonte para arte paralela. "Normal" e
 * "Parallel" sao o que a fonte permite afirmar; classificacoes mais finas como
 * "Manga" nao existem no dado e nao sao adivinhadas aqui. O sourceId preserva o
 * sufixo exato, entao uma taxonomia mais rica pode ser derivada depois sem
 * reimportar.
 */
function variantTypeFor(sourceId: string, cardCode: string): string {
  return sourceId === cardCode ? 'Normal' : 'Parallel'
}

export function parseCardList(html: string): CatalogPage {
  const blocks = html.match(/<dl class="modalCol"[\s\S]*?<\/dl>/g) ?? []

  const cardsByCode = new Map<string, CardDTO>()
  const setsByCode = new Map<string, SetDTO>()
  const variants: VariantDTO[] = []
  const rejected: RejectedEntry[] = []
  const unmappedSetNames = new Set<string>()

  for (const block of blocks) {
    const sourceId = /<dl class="modalCol" id="([^"]+)"/.exec(block)?.[1]?.trim() ?? null
    if (!sourceId) {
      rejected.push({ sourceId: null, reason: 'entrada sem identificador' })
      continue
    }

    const info = Array.from(
      /<div class="infoCol">([\s\S]*?)<\/div>/.exec(block)?.[1]?.matchAll(/<span>([^<]*)<\/span>/g) ??
        [],
      (match) => text(match[1]),
    )
    if (info.length < 3) {
      rejected.push({ sourceId, reason: 'cabecalho sem codigo, raridade e tipo' })
      continue
    }

    const [code, rarity, rawType] = info
    const type = toCardType(rawType)
    if (!type) {
      // DON!! esta fora do catalogo, e qualquer tipo novo e reportado em vez de
      // ser adivinhado.
      rejected.push({ sourceId, reason: `tipo de carta nao reconhecido: ${rawType}` })
      continue
    }

    const name = divValue(block, 'cardName')
    if (!name) {
      rejected.push({ sourceId, reason: 'carta sem nome' })
      continue
    }

    const firstFieldLabel = divLabel(block, 'cost')
    const firstFieldValue = numberOrNull(divValue(block, 'cost'))
    const isLife = firstFieldLabel?.toLowerCase() === 'life'

    const effectText = divValue(block, 'text') ?? ''
    const attributeText = /<div class="attribute">[\s\S]*?<i>([\s\S]*?)<\/i>/.exec(block)?.[1]
    const rawImage = /<img[^>]+data-src="([^"]+)"/.exec(block)?.[1] ?? null

    const card: CardDTO = {
      code,
      name,
      type,
      cost: isLife ? null : firstFieldValue,
      life: isLife ? firstFieldValue : null,
      power: numberOrNull(divValue(block, 'power')),
      counter: numberOrNull(divValue(block, 'counter')),
      hasTrigger: effectText.includes('[Trigger]'),
      blockIcon: divValue(block, 'block'),
      colors: splitList(divValue(block, 'color')),
      traits: splitList(divValue(block, 'feature')),
      attributes: splitList(attributeText ? text(attributeText) : null),
      mechanics: extractMechanics(effectText),
    }

    // Artes diferentes da mesma carta repetem os dados da carta. A primeira
    // vence; as demais so contribuem com a variante.
    if (!cardsByCode.has(code)) cardsByCode.set(code, card)

    const printings = parseSets(divValue(block, 'getInfo'))
    for (const set of printings.sets) {
      if (!setsByCode.has(set.code)) setsByCode.set(set.code, set)
    }
    for (const name of printings.unmapped) unmappedSetNames.add(name)

    variants.push({
      sourceId,
      cardCode: code,
      variantType: variantTypeFor(sourceId, code),
      rarity: rarity === '' || rarity === '-' ? null : rarity,
      imageUrl: rawImage ? absoluteImageUrl(rawImage) : null,
      printedInSetCodes: printings.sets.map((set) => set.code),
    })
  }

  return {
    sets: [...setsByCode.values()],
    cards: [...cardsByCode.values()],
    variants,
    rejected,
    unmappedSetNames: [...unmappedSetNames],
  }
}

/**
 * As imagens sao referenciadas na origem, nunca copiadas (decisao 020). A URL
 * vem relativa e com uma query de cache que nao faz parte da identidade do
 * arquivo.
 */
function absoluteImageUrl(rawSrc: string): string {
  const fileName = rawSrc.split('/').pop()?.split('?')[0]
  return fileName ? `${IMAGE_BASE}${fileName}` : rawSrc
}
