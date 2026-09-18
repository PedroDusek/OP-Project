import { readdir, mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { normalizeSetCode } from '@/server/domain/catalog/sets'

/**
 * As capas das coleções e dos decks, a partir das imagens do dono do produto.
 *
 * Roda à mão quando chegar imagem nova: `npx tsx scripts/preparar-capas.ts`.
 * A origem é `Imagens OPTCG/{Ops,Decks}/{Light,Dark}/<CÓDIGO> <Tema>.jpg`, fora
 * do Git (48 MB); o resultado, `public/sets/{claro,escuro}/<codigo>.webp`, entra.
 *
 * ## O fundo vira transparente
 *
 * Cada imagem vem com um fundo liso — `#f1f2f4` na clara, `#242328` na escura —
 * que é quase, e não exatamente, o das telas (`#f2f2f3`/`#ffffff` no claro,
 * `#131219`/`#1c1b24` no escuro). Em vez de escolher um e errar nos outros, o
 * fundo sai: é preenchido **a partir das bordas**, então só o que toca a borda
 * some. Uma cor parecida dentro do pacote fica, porque não está ligada à borda.
 * A transição é suave na faixa de tolerância, para a borda da forma roxa não
 * ficar serrilhada. A forma roxa da marca continua, e muda de tom com o tema —
 * é por ela que existem as duas versões.
 */

const ORIGEM = 'Imagens OPTCG'
const DESTINO = 'public/sets'
const LARGURA = 540
/** Abaixo disto é fundo; acima de `SUAVE` é imagem; entre, meio transparente. */
const DURO = 14
const SUAVE = 44

async function semFundo(arquivo: string): Promise<Buffer> {
  const { data, info } = await sharp(arquivo)
    .resize({ width: LARGURA })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const fundo = [data[0], data[1], data[2]]
  const distancia = (p: number) =>
    Math.hypot(data[p * 3] - fundo[0], data[p * 3 + 1] - fundo[1], data[p * 3 + 2] - fundo[2])

  const alfa = new Uint8Array(width * height).fill(255)
  const visto = new Uint8Array(width * height)
  const fila: number[] = []
  const semear = (p: number) => {
    if (!visto[p] && distancia(p) < SUAVE) {
      visto[p] = 1
      fila.push(p)
    }
  }
  for (let x = 0; x < width; x++) {
    semear(x)
    semear((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    semear(y * width)
    semear(y * width + width - 1)
  }

  while (fila.length) {
    const p = fila.pop()!
    const d = distancia(p)
    alfa[p] = d <= DURO ? 0 : Math.round((255 * (d - DURO)) / (SUAVE - DURO))
    // Só o fundo firme propaga: a faixa suave é a borda, e para ali.
    if (d > DURO) continue
    const x = p % width
    if (x > 0) semear(p - 1)
    if (x < width - 1) semear(p + 1)
    if (p >= width) semear(p - width)
    if (p < width * (height - 1)) semear(p + width)
  }

  const saida = Buffer.alloc(width * height * 4)
  for (let p = 0; p < width * height; p++) {
    const a = alfa[p] / 255
    for (let c = 0; c < 3; c++) {
      // Tira a cor do fundo que o anti-serrilhado misturou na borda.
      const original = data[p * 3 + c]
      saida[p * 4 + c] = a > 0 ? Math.max(0, Math.min(255, Math.round((original - fundo[c] * (1 - a)) / a))) : 0
    }
    saida[p * 4 + 3] = alfa[p]
  }
  return sharp(saida, { raw: { width, height, channels: 4 } }).webp({ quality: 82, alphaQuality: 90 }).toBuffer()
}

async function main() {
  const codigos: string[] = []
  for (const grupo of ['Ops', 'Decks']) {
    for (const [tema, pasta] of [['Light', 'claro'], ['Dark', 'escuro']] as const) {
      const dir = path.join(ORIGEM, grupo, tema)
      await mkdir(path.join(DESTINO, pasta), { recursive: true })
      for (const nome of await readdir(dir)) {
        const codigo = normalizeSetCode(nome.replace(new RegExp(` ${tema}\.jpe?g$`, 'i'), ''))
        const imagem = await semFundo(path.join(dir, nome))
        await sharp(imagem).toFile(path.join(DESTINO, pasta, `${codigo.toLowerCase()}.webp`))
        if (pasta === 'claro') codigos.push(codigo)
      }
    }
  }
  console.log(`${codigos.length} capas, nas duas versoes:`)
  console.log(JSON.stringify(codigos.sort()))
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
