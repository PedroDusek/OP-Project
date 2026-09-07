/**
 * Gera os arquivos de marca para a interface a partir do arquivo mestre
 * `docs/marca/originais/COLEXA LOGO.ai`.
 *
 * Por que existe: os JPG de 4500 px sao exportacao de impressao — CMYK, sem
 * transparencia, com o fundo gravado no arquivo. Navegador nao le CMYK de forma
 * confiavel, e fundo opaco vira um retangulo sobre qualquer superficie que nao
 * seja exatamente a do arquivo. Ver `docs/marca/README.md`.
 *
 * O `.ai` e um PDF, e a marca esta la como **curvas de verdade**, nao como
 * imagem colocada. Entao nada aqui e traçado nem aproximado: as curvas de Bezier
 * saem do arquivo mestre para o SVG sem perda.
 *
 * As cores, essas sim, sao substituidas. O arquivo esta em CMYK de impressao, e
 * a conversao para RGB nunca vale mais que o valor que o dono do produto
 * confirmou. Ver a paleta em `docs/marca/README.md`.
 *
 *   node scripts/marca/gen.mjs
 *
 * Roda sob demanda, nunca no build. Exige `sharp`, que ja vem com o Next.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { contentStream, parsePaths, pathData, boundsOf } from './pdf-vetor.mjs'

const ORIGINAL = fileURLToPath(new URL('../../docs/marca/originais/COLEXA LOGO.ai', import.meta.url))
const PUBLIC = fileURLToPath(new URL('../../public/marca/', import.meta.url))
const APP = fileURLToPath(new URL('../../src/app/', import.meta.url))
const LIB = fileURLToPath(new URL('../../src/lib/', import.meta.url))

/** Paleta confirmada. O roxo muda entre os temas e nao e derivado por filtro. */
const ROXO_CLARO = '#38287B'
const ROXO_ESCURO = '#504797'
const FUNDO_CLARO = '#F2F2F3'

/** Objeto do content stream da unica pagina do arquivo. */
const CONTENT_OBJ = 8

const paths = parsePaths(contentStream(ORIGINAL, CONTENT_OBJ)).map((p) => ({
  ...p,
  box: boundsOf(p.subs),
}))

const area = (b) => (b.x1 - b.x0) * (b.y1 - b.y0)
const cinza = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return Math.abs(r - g) < 24 && Math.abs(g - b) < 24
}

/**
 * O arquivo mestre e uma prancheta com varias versoes da marca lado a lado.
 * Selecionar por posicao seria fragil; o que distingue de verdade e a forma:
 *
 *   - retangulos grandes sao os fundos dos paineis, nao a marca;
 *   - o X e o unico caminho colorido — as letras sao pretas ou brancas;
 *   - um logotipo e um X com exatamente cinco letras na mesma faixa vertical;
 *   - o simbolo sozinho e o X que nao tem letras ao redor.
 */
const marca = paths.filter((p) => !(p.subs.length === 1 && area(p.box) > 50_000))
const xis = marca.filter((p) => !cinza(p.fill))
const letras = marca.filter((p) => cinza(p.fill))

/**
 * Letras que formam lockup com este X: mesma faixa vertical **e** encostadas
 * nele na horizontal. So a faixa vertical nao basta — as versoes clara e escura
 * ficam lado a lado na mesma altura, e sem o segundo teste as duas viravam um
 * unico logotipo de dez letras.
 */
function naFaixa(x) {
  const centro = (b) => (b.y0 + b.y1) / 2
  const banda = letras
    .filter((l) => centro(l.box) > x.box.y0 && centro(l.box) < x.box.y1)
    .sort((a, b) => a.box.x0 - b.box.x0)

  // O espaco entre letras da mesma palavra e uma fracao da largura da letra; o
  // espaco entre duas versoes da marca e maior que isso.
  const vizinha = (a, b) => b.box.x0 - a.box.x1 < (a.box.x1 - a.box.x0) / 2

  const antes = []
  for (let i = banda.length - 1; i >= 0; i--) {
    if (banda[i].box.x1 > x.box.x0) continue
    const seguinte = antes[0] ?? x
    if (!vizinha(banda[i], seguinte)) break
    antes.unshift(banda[i])
  }
  const depois = []
  for (const l of banda) {
    if (l.box.x0 < x.box.x1) continue
    const anterior = depois[depois.length - 1] ?? x
    if (!vizinha(anterior, l)) break
    depois.push(l)
  }
  return [...antes, ...depois]
}

const lockups = xis.map((x) => ({ x, letras: naFaixa(x) }))
const logotipo = lockups.find((l) => l.letras.length === 5 && l.letras[0].fill === '#000000')
const simbolo = lockups
  .filter((l) => l.letras.length === 0)
  .sort((a, b) => area(b.x.box) - area(a.x.box))[0]?.x

if (!logotipo || !simbolo) {
  throw new Error(
    `Nao reconheci a marca no arquivo mestre: ${xis.length} caminhos coloridos, ` +
      `${letras.length} letras. O arquivo mudou? Ver os criterios de selecao acima.`,
  )
}

const uniao = (boxes) => ({
  x0: Math.min(...boxes.map((b) => b.x0)),
  y0: Math.min(...boxes.map((b) => b.y0)),
  x1: Math.max(...boxes.map((b) => b.x1)),
  y1: Math.max(...boxes.map((b) => b.y1)),
})

/**
 * O SVG carrega os dois temas. Um arquivo servido cru — favicon, icone de app,
 * `<img>` — nao recebe CSS de fora, entao a regra de tema mora dentro dele.
 */
const documento = ({ w, h, estilo, corpo }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="ColeXa">` +
  `<style>${estilo}</style>${corpo}</svg>\n`

const arredonda = (v) => Number(v.toFixed(2))

mkdirSync(PUBLIC, { recursive: true })
mkdirSync(LIB, { recursive: true })

// ---------------------------------------------------------------- simbolo

const boxS = simbolo.box
const escalaS = 256 / (boxS.y1 - boxS.y0)
const larguraS = arredonda((boxS.x1 - boxS.x0) * escalaS)
const dSimbolo = pathData(simbolo.subs, { scale: escalaS, dx: boxS.x0, flipY: boxS.y1 })

const svgSimbolo = documento({
  w: larguraS,
  h: 256,
  estilo: `.marca{fill:${ROXO_CLARO}}@media(prefers-color-scheme:dark){.marca{fill:${ROXO_ESCURO}}}`,
  corpo: `<path class="marca" fill-rule="${simbolo.rule}" d="${dSimbolo}"/>`,
})

writeFileSync(PUBLIC + 'symbol.svg', svgSimbolo)
writeFileSync(APP + 'icon.svg', svgSimbolo)
console.log(`symbol.svg   ${svgSimbolo.length} bytes`)

// PNG de icone. O simbolo sozinho encosta nos cantos do quadrado, entao entra
// com folga. O do Apple leva fundo: iOS nao respeita transparencia em icone.
async function quadrado(lado, fundo, destino) {
  const folga = Math.round(lado * 0.16)
  const altura = lado - folga * 2
  const largura = Math.round((larguraS / 256) * altura)
  const desenho = await sharp(Buffer.from(svgSimbolo), { density: 900 })
    .resize(largura, altura, { fit: 'fill' })
    .png()
    .toBuffer()
  await sharp({ create: { width: lado, height: lado, channels: 4, background: fundo } })
    .composite([
      {
        input: desenho,
        left: Math.round((lado - largura) / 2),
        top: Math.round((lado - altura) / 2),
      },
    ])
    .png()
    .toFile(destino)
}

const transparente = { r: 0, g: 0, b: 0, alpha: 0 }
await quadrado(180, FUNDO_CLARO, APP + 'apple-icon.png')
await quadrado(192, transparente, PUBLIC + 'icon-192.png')
await quadrado(512, transparente, PUBLIC + 'icon-512.png')
console.log('apple-icon.png, icon-192.png, icon-512.png')

// --------------------------------------------------------------- logotipo

const boxL = uniao([logotipo.x.box, ...logotipo.letras.map((l) => l.box)])
const escalaL = 64 / (boxL.y1 - boxL.y0)
const opcoes = { scale: escalaL, dx: boxL.x0, flipY: boxL.y1 }
const larguraL = arredonda((boxL.x1 - boxL.x0) * escalaL)

const dLetras = logotipo.letras.map((l) => pathData(l.subs, opcoes)).join('')
const dXis = pathData(logotipo.x.subs, opcoes)

const svgLogotipo = documento({
  w: larguraL,
  h: 64,
  estilo:
    `.letra{fill:#000}.marca{fill:${ROXO_CLARO}}` +
    `@media(prefers-color-scheme:dark){.letra{fill:#FFF}.marca{fill:${ROXO_ESCURO}}}`,
  corpo:
    `<path class="letra" fill-rule="${logotipo.letras[0].rule}" d="${dLetras}"/>` +
    `<path class="marca" fill-rule="${logotipo.x.rule}" d="${dXis}"/>`,
})

writeFileSync(PUBLIC + 'logotype.svg', svgLogotipo)
console.log(`logotype.svg ${svgLogotipo.length} bytes`)

// Modulo consumido pelos componentes React. Inline, e nao `<img>`, porque o
// cabecalho precisa da marca acompanhando o tema **escolhido pela pessoa**, e um
// arquivo servido cru so enxerga a preferencia do sistema operacional.
const modulo = `/**
 * Contornos da marca, em RGB e com transparencia.
 *
 * GERADO por \`node scripts/marca/gen.mjs\` a partir de
 * \`docs/marca/originais/COLEXA LOGO.ai\`. Nao edite a mao: a proxima geracao
 * sobrescreve. As curvas sao as do arquivo mestre, sem tracado nem aproximacao.
 */

export const SYMBOL = {
  width: ${larguraS},
  height: 256,
  fillRule: '${simbolo.rule}',
  /** O X de duas cartas cruzadas. */
  path: '${dSimbolo}',
} as const

export const LOGOTYPE = {
  width: ${larguraL},
  height: 64,
  fillRule: '${logotipo.x.rule}',
  /** C, O, L, E e A. Acompanha a cor do texto. */
  letters: '${dLetras}',
  /** O X, no roxo da marca. */
  symbol: '${dXis}',
} as const
`
writeFileSync(LIB + 'marca.ts', modulo)
console.log(`src/lib/marca.ts  ${modulo.length} bytes`)
