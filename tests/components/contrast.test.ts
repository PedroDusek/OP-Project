import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contraste dos tokens, medido no arquivo de tokens.
 *
 * Secao 18 do documento oficial: contraste adequado em todos os estados. Isso
 * nao se verifica olhando — a diferenca entre 4.4:1 e 4.6:1 nao aparece a olho
 * nu, e some de vez no monitor de quem escreveu o CSS.
 *
 * O teste le `globals.css` em vez de repetir os valores num objeto. Uma copia em
 * TypeScript passaria a divergir do CSS no dia em que alguem ajustasse um tom,
 * e o teste continuaria verde medindo a paleta antiga — que e exatamente o
 * problema que ele existe para pegar.
 *
 * Dois casos ja foram encontrados assim:
 *
 *   - `text-subtle` claro estava a 45% de preto: 3.35:1, abaixo do minimo.
 *   - `accent` no tema escuro da 2.18:1 como **tinta** sobre a superficie. O
 *     roxo escuro da paleta foi feito para receber texto branco por cima, nao
 *     para ser o texto. Dai a existencia de `accent-ink`.
 */

// Caminho a partir da raiz do projeto: no ambiente jsdom, `import.meta.url` nao
// e uma URL `file:`, e `fileURLToPath` recusa.
const CSS = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')

type Rgba = [number, number, number, number]

/** Le `--colexa-<nome>` e devolve o par [claro, escuro]. */
function token(name: string): [Rgba, Rgba] {
  const declaration = new RegExp(`--colexa-${name}:\\s*([^;]+);`).exec(CSS)
  if (!declaration) throw new Error(`Token --colexa-${name} nao existe em globals.css.`)

  const value = declaration[1].trim()
  const pair = /^light-dark\(\s*(.+?)\s*,\s*(.+?)\s*\)$/.exec(value)
  // Token sem `light-dark()` vale igual nos dois temas, como `accent-contrast`.
  if (!pair) return [parseColor(value), parseColor(value)]
  return [parseColor(pair[1]), parseColor(pair[2])]
}

function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  const rgb = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\s*\)$/.exec(value)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), Number(rgb[4])]
  throw new Error(`Cor em formato nao reconhecido: ${value}`)
}

/** Compoe uma cor com alfa sobre um fundo opaco. */
function flatten(color: Rgba, background: Rgba): Rgba {
  const [r, g, b, a] = color
  return [
    r * a + background[0] * (1 - a),
    g * a + background[1] * (1 - a),
    b * a + background[2] * (1 - a),
    1,
  ]
}

function luminance([r, g, b]: Rgba): number {
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(foreground: Rgba, background: Rgba): number {
  const front = flatten(foreground, background)
  const [a, b] = [luminance(front), luminance(background)].sort((x, y) => y - x)
  return (a + 0.05) / (b + 0.05)
}

const THEMES = [0, 1] as const
const THEME_NAME = ['claro', 'escuro'] as const

/** Superficies opacas onde o texto pousa. */
function surfaces(theme: 0 | 1) {
  const background = token('background')[theme]
  const surface = token('surface')[theme]
  return {
    background,
    surface,
    'surface-muted': flatten(token('surface-muted')[theme], surface),
    'accent-soft': flatten(token('accent-soft')[theme], surface),
    'success-soft': flatten(token('success-soft')[theme], surface),
    'danger-soft': flatten(token('danger-soft')[theme], surface),
    'warning-soft': flatten(token('warning-soft')[theme], surface),
    accent: token('accent')[theme],
  }
}

/** WCAG AA: 4.5:1 para texto normal, 3:1 para grafico e limite de componente. */
const TEXTO = 4.5
const GRAFICO = 3

describe.each(THEMES)('contraste no tema %s', (theme) => {
  const name = THEME_NAME[theme]
  const on = surfaces(theme)

  it(`texto principal sobre superficie e fundo (${name})`, () => {
    const text = token('text')[theme]
    expect(contrast(text, on.surface)).toBeGreaterThanOrEqual(TEXTO)
    expect(contrast(text, on.background)).toBeGreaterThanOrEqual(TEXTO)
  })

  it(`texto de apoio sobre superficie e fundo (${name})`, () => {
    const muted = token('text-muted')[theme]
    expect(contrast(muted, on.surface)).toBeGreaterThanOrEqual(TEXTO)
    expect(contrast(muted, on.background)).toBeGreaterThanOrEqual(TEXTO)
  })

  /** Legenda e metadado sao texto pequeno: valem o mesmo minimo. */
  it(`legenda sobre superficie e fundo (${name})`, () => {
    const subtle = token('text-subtle')[theme]
    expect(contrast(subtle, on.surface)).toBeGreaterThanOrEqual(TEXTO)
    expect(contrast(subtle, on.background)).toBeGreaterThanOrEqual(TEXTO)
  })

  /** Botao primario, avatar, alternancia ligada. */
  it(`texto sobre a enfase preenchida (${name})`, () => {
    expect(contrast(token('accent-contrast')[theme], on.accent)).toBeGreaterThanOrEqual(TEXTO)
  })

  /**
   * Chip selecionado, navegacao ativa, badge de enfase, botao suave. E aqui que
   * o `accent` do tema escuro falharia, com 1.82:1 sobre `accent-soft`.
   */
  it(`enfase como tinta, em toda superficie onde aparece (${name})`, () => {
    const ink = token('accent-ink')[theme]
    for (const surface of ['surface', 'background', 'accent-soft', 'surface-muted'] as const) {
      expect(
        contrast(ink, on[surface]),
        `accent-ink sobre ${surface} no tema ${name}`,
      ).toBeGreaterThanOrEqual(TEXTO)
    }
  })

  it.each(['success', 'danger', 'warning'] as const)(
    `%s sobre sua propria superficie suave (${name})`,
    (tone) => {
      const color = token(tone)[theme]
      expect(contrast(color, on[`${tone}-soft`])).toBeGreaterThanOrEqual(TEXTO)
      expect(contrast(color, on.surface)).toBeGreaterThanOrEqual(TEXTO)
    },
  )

  /** Barra de progresso: grafico fino sobre o trilho. */
  it(`progresso contra o trilho (${name})`, () => {
    expect(contrast(token('accent-ink')[theme], on['surface-muted'])).toBeGreaterThanOrEqual(
      GRAFICO,
    )
    expect(contrast(token('success')[theme], on['surface-muted'])).toBeGreaterThanOrEqual(GRAFICO)
  })

  /** Anel de foco: 3:1 contra o que estiver em volta (secao 18). */
  it(`anel de foco contra superficie e fundo (${name})`, () => {
    const ink = token('accent-ink')[theme]
    expect(contrast(ink, on.surface)).toBeGreaterThanOrEqual(GRAFICO)
    expect(contrast(ink, on.background)).toBeGreaterThanOrEqual(GRAFICO)
  })

  /** A borda precisa separar o card do fundo, ou o card some. */
  it(`borda contra superficie e fundo (${name})`, () => {
    const border = token('border')[theme]
    expect(contrast(border, on.surface)).toBeGreaterThan(1.1)
    expect(contrast(border, on.background)).toBeGreaterThan(1.05)
  })
})

describe('paleta oficial', () => {
  /**
   * As seis cores confirmadas pelo dono do produto. Este teste nao mede nada:
   * ele impede que uma delas mude por acidente, porque as tres restricoes de
   * marca sao "nao alterar sem revisao da identidade".
   */
  it.each([
    ['background', '#f2f2f3', '#131219'],
    ['accent', '#38287b', '#504797'],
    ['text', '#000000', '#ffffff'],
  ])('%s continua igual ao documento oficial', (name, claro, escuro) => {
    const declaration = new RegExp(`--colexa-${name}:\\s*light-dark\\(([^)]+)\\);`).exec(CSS)
    expect(declaration).not.toBeNull()
    const [a, b] = declaration![1].split(',').map((value) => value.trim().toLowerCase())
    expect(a).toBe(claro)
    expect(b).toBe(escuro)
  })
})
