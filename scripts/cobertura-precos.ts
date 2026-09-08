import 'dotenv/config'
import { commonArtByNumber, type SourceProduct } from '@/server/domain/prices/matching'
import { createPrisma } from '@/server/infrastructure/prisma'

/**
 * Onde estao as cartas sem preco, e por que.
 *
 * Diagnostico, nao rotina: roda a mao quando a cobertura precisa ser explicada.
 * Classifica cada carta do nosso catalogo, para a conversa ser sobre numeros e
 * nao sobre impressao.
 */

const BASE = 'https://tcgcsv.com/tcgplayer'
const CATEGORY_ID = 68
const USER_AGENT = 'ColeXa/1.0 (+https://colexa.com.br)'

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return (await response.json()) as T
}

interface Group {
  groupId: number
  name: string
  abbreviation: string | null
}
interface Product {
  productId: number
  name: string
  extendedData?: { name: string; value: string }[]
}
interface Price {
  productId: number
  marketPrice: number | null
  subTypeName: string | null
}

async function main() {
  const prisma = createPrisma(process.env.DATABASE_URL!)

  const nossas = await prisma.card.findMany({ select: { code: true, name: true } })
  const nossos = new Set(nossas.map((c) => c.code.toUpperCase()))
  const nomes = new Map(nossas.map((c) => [c.code.toUpperCase(), c.name]))

  const groups = await get<{ results: Group[] }>(`${BASE}/${CATEGORY_ID}/groups`)

  const naFonte = new Set<string>()
  const comArteComum = new Set<string>()
  const comPreco = new Set<string>()
  const doisAcabamentos = new Set<string>()
  const semCotacao = new Set<string>()
  const exemplosDois: string[] = []

  for (const group of groups.results) {
    const [products, prices] = await Promise.all([
      get<{ results: Product[] }>(`${BASE}/${CATEGORY_ID}/${group.groupId}/products`),
      get<{ results: Price[] }>(`${BASE}/${CATEGORY_ID}/${group.groupId}/prices`),
    ])

    // Todos os acabamentos com cotacao, por produto: Normal e Foil sao o mesmo
    // produto impresso de dois jeitos, nao artes diferentes.
    const mercado = new Map<number, number[]>()
    for (const p of prices.results) {
      if (!p.marketPrice || p.marketPrice <= 0) continue
      const lista = mercado.get(p.productId)
      if (lista) lista.push(p.marketPrice)
      else mercado.set(p.productId, [p.marketPrice])
    }

    const cartas: SourceProduct[] = []
    for (const p of products.results) {
      const number = p.extendedData?.find((f) => f.name === 'Number')?.value
      if (!number) continue
      naFonte.add(number.trim().toUpperCase())
      cartas.push({ productId: p.productId, name: p.name, number })
    }

    for (const [number, produto] of commonArtByNumber(cartas, nomes)) {
      comArteComum.add(number)
      const valores = mercado.get(produto.productId)
      if (!valores) {
        semCotacao.add(number)
      } else if (valores.length > 1) {
        doisAcabamentos.add(number)
        if (exemplosDois.length < 6) {
          exemplosDois.push(`${number} ${produto.name} :: ${valores.join(' / ')}`)
        }
      } else {
        comPreco.add(number)
      }
    }

    await new Promise((r) => setTimeout(r, 60))
  }

  const conta = (fn: (code: string) => boolean) => [...nossos].filter(fn).length

  const total = nossos.size
  const temPreco = conta((c) => comPreco.has(c))
  const dois = conta((c) => !comPreco.has(c) && doisAcabamentos.has(c))
  const sem = conta((c) => !comPreco.has(c) && !doisAcabamentos.has(c) && semCotacao.has(c))
  const naoIdentificada = conta((c) => !comArteComum.has(c) && naFonte.has(c))
  const foraDaFonte = conta((c) => !naFonte.has(c))

  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`
  console.log(`cartas no nosso catalogo: ${total}`)
  console.log(`  com preco:                        ${temPreco} (${pct(temPreco)})`)
  console.log(`  arte comum com dois acabamentos:  ${dois} (${pct(dois)})`)
  console.log(`  arte comum sem cotacao na fonte:  ${sem} (${pct(sem)})`)
  console.log(`  arte comum nao identificada:      ${naoIdentificada} (${pct(naoIdentificada)})`)
  console.log(`  fora da fonte:                    ${foraDaFonte} (${pct(foraDaFonte)})`)

  console.log('')
  console.log('dois acabamentos, exemplos:')
  for (const e of exemplosDois) console.log(`  ${e}`)

  const naoId = [...nossos].filter((c) => !comArteComum.has(c) && naFonte.has(c)).slice(0, 12)
  console.log('')
  console.log(`nao identificadas, exemplos: ${naoId.join(', ')}`)

  await prisma.$disconnect()
}

main().catch((e: unknown) => {
  console.error('FALHOU:', e)
  process.exit(1)
})
