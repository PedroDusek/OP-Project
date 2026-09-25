import { describe, expect, it } from 'vitest'
import {
  sourceIdFromFile,
  storedImageFile,
  storedImageFromOrigin,
  storedImageUrl,
  STORED_IMAGE_ROUTE,
} from '@/server/domain/catalog/stored-image'

/**
 * O nome do arquivo da arte guardada (decisão 113).
 *
 * Ele vira caminho de arquivo no disco da máquina, então o que não é nome
 * conhecido é **recusado** — e não consertado. Consertar um identificador
 * estranho seria adivinhar qual arquivo alguém quis pedir.
 */
describe('o arquivo da arte guardada', () => {
  it('sai do source_id, que e por arte', () => {
    // Uma carta tem varias artes, e cada uma tem imagem propria.
    expect(storedImageFile('OP01-016')).toBe('OP01-016.webp')
    expect(storedImageFile('OP01-016_p3')).toBe('OP01-016_p3.webp')
    // O DON!! usa o productId do TCGplayer como source_id.
    expect(storedImageFile('482236')).toBe('482236.webp')
  })

  it('monta o endereco publico', () => {
    expect(storedImageUrl('OP01-016_p3')).toBe(`${STORED_IMAGE_ROUTE}/OP01-016_p3.webp`)
  })

  /*
   * A recusa e a defesa: sem ela, um identificador com `../` viraria pedido de
   * arquivo fora da pasta.
   */
  it('recusa o que nao e nome conhecido', () => {
    expect(storedImageFile('../../etc/passwd')).toBeNull()
    expect(storedImageFile('OP01/016')).toBeNull()
    expect(storedImageFile('OP01 016')).toBeNull()
    expect(storedImageFile('')).toBeNull()
    expect(storedImageFile('   ')).toBeNull()
    expect(storedImageFile(null)).toBeNull()
  })

  it('le o source_id de volta do nome do arquivo', () => {
    expect(sourceIdFromFile('OP01-016_p3.webp')).toBe('OP01-016_p3')
    expect(sourceIdFromFile('482236.webp')).toBe('482236')
  })

  it('a leitura de volta recusa o mesmo que a ida', () => {
    expect(sourceIdFromFile('OP01-016.png')).toBeNull()
    expect(sourceIdFromFile('../segredo.webp')).toBeNull()
    expect(sourceIdFromFile('.webp')).toBeNull()
  })

  /* Ida e volta batem: e o que garante que a rota ache o arquivo que a tela pediu. */
  it('ida e volta batem', () => {
    for (const id of ['OP01-016', 'OP01-016_p3', '482236', 'ST-17-001']) {
      expect(sourceIdFromFile(storedImageFile(id)!)).toBe(id)
    }
  })
})

/**
 * A troca acontece num lugar só (decisão 113).
 *
 * O `source_id` já está dentro do endereço das duas origens, então dá para
 * chegar à arte guardada sem mexer nas dezenas de telas que passam `imageUrl`
 * adiante.
 */
describe('a arte guardada a partir do endereco de origem', () => {
  it('le o source_id do endereco da Bandai', () => {
    expect(storedImageFromOrigin('https://en.onepiece-cardgame.com/images/cardlist/card/OP01-016.png')).toBe(
      '/imagens/cartas/OP01-016.webp',
    )
    expect(storedImageFromOrigin('https://en.onepiece-cardgame.com/images/cardlist/card/OP01-016_p3.png')).toBe(
      '/imagens/cartas/OP01-016_p3.webp',
    )
  })

  /* O DON!! vem do TCGplayer, com o productId no nome do arquivo. */
  it('le o productId do endereco do TCGplayer', () => {
    expect(storedImageFromOrigin('https://tcgplayer-cdn.tcgplayer.com/product/482236_200w.jpg')).toBe(
      '/imagens/cartas/482236.webp',
    )
  })

  /*
   * Endereco desconhecido segue para a origem: e o que faz a troca ser
   * reversivel, e o que impede uma origem nova virar imagem quebrada calada.
   */
  it('devolve nulo para endereco que nao reconhecemos', () => {
    expect(storedImageFromOrigin('https://exemplo.com/foto.png')).toBeNull()
    expect(storedImageFromOrigin('')).toBeNull()
    expect(storedImageFromOrigin(null)).toBeNull()
  })

  /* Endereco que ja e nosso nao e reescrito. */
  it('nao mexe no que ja aponta para nos', () => {
    expect(storedImageFromOrigin('/imagens/cartas/OP01-016.webp')).toBe('/imagens/cartas/OP01-016.webp')
  })
})
