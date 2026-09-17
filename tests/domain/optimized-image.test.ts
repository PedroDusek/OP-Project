import { describe, expect, it } from 'vitest'
import {
  optimizedImageUrl,
  WARMUP_QUALITY,
  WARMUP_WIDTHS,
} from '@/server/domain/catalog/optimized-image'

/** O endereço que o pré-aquecimento pede (decisão 094). */

describe('optimizedImageUrl', () => {
  it('é o mesmo endereço que o next/image pede, com a imagem codificada', () => {
    expect(
      optimizedImageUrl('https://colexa.fly.dev', 'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png', 256),
    ).toBe(
      'https://colexa.fly.dev/_next/image?url=https%3A%2F%2Fen.onepiece-cardgame.com%2Fimages%2Fcardlist%2Fcard%2FOP01-001.png&w=256&q=75',
    )
  })

  it('não duplica a barra do endereço do site', () => {
    expect(optimizedImageUrl('https://colexa.com.br/', 'https://x.test/a.png', 384)).toContain(
      'https://colexa.com.br/_next/image?',
    )
  })

  it('as larguras e a qualidade são as que a grade usa', () => {
    expect([...WARMUP_WIDTHS]).toEqual([256, 384])
    expect(WARMUP_QUALITY).toBe(75)
  })
})
