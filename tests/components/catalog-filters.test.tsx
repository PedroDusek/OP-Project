import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CatalogFilters } from '@/components/catalog/catalog-filters'
import type { CatalogVocabulary } from '@/server/application/catalog/vocabulary'

/**
 * O painel de filtros com vários valores por seção.
 *
 * Dentro de uma seção vale o **ou**; entre seções, o **e**. Antes, cada seção
 * aceitava um valor só: escolher a segunda cor apagava a primeira, e não havia
 * como pedir "as pretas e as azuis" de uma vez.
 */

const push = vi.hoisted(() => vi.fn())
const search = vi.hoisted(() => ({ value: new URLSearchParams() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/catalogo',
  useSearchParams: () => search.value,
}))

const VOCABULARY: CatalogVocabulary = {
  sets: [
    { code: 'OP01', displayCode: 'OP01', displayName: 'ROMANCE DAWN', kind: 'collection' as const },
    { code: 'ST-01', displayCode: 'ST01', displayName: 'Straw Hat Crew', kind: 'deck' as const },
  ],
  types: ['Leader', 'Character', 'Event', 'Stage'],
  rarities: ['C', 'UC', 'R', 'SR'],
  variantTypes: ['Normal', 'Parallel'],
  colors: ['Red', 'Green', 'Blue', 'Yellow', 'Purple', 'Black'],
  attributes: ['Slash', 'Strike'],
  mechanics: ['Rush', 'Blocker'],
  traits: ['Straw Hat Crew', 'Supernovas', 'Navy'],
  costRange: { min: 0, max: 10 },
  powerRange: { min: 0, max: 12000 },
}

beforeEach(() => {
  search.value = new URLSearchParams()
})

afterEach(() => {
  push.mockClear()
})

async function abrir(activeCount = 0) {
  render(<CatalogFilters vocabulary={VOCABULARY} activeCount={activeCount} />)
  await userEvent.click(screen.getByRole('button', { name: /Filtros/ }))
  return screen.findByRole('dialog')
}

/** A URL que o painel mandou navegar, já como parâmetros. */
function pushed(): URLSearchParams {
  const href = String(push.mock.calls[0][0])
  return new URLSearchParams(href.slice(href.indexOf('?') + 1))
}

describe('escolher vários na mesma seção', () => {
  it('mantém as duas cores marcadas', async () => {
    const painel = await abrir()

    await userEvent.click(within(painel).getByRole('button', { name: 'Black' }))
    await userEvent.click(within(painel).getByRole('button', { name: 'Blue' }))

    expect(within(painel).getByRole('button', { name: 'Black' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(painel).getByRole('button', { name: 'Blue' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('manda as duas na URL, como parâmetro repetido', async () => {
    const painel = await abrir()

    await userEvent.click(within(painel).getByRole('button', { name: 'Black' }))
    await userEvent.click(within(painel).getByRole('button', { name: 'Blue' }))
    await userEvent.click(within(painel).getByRole('button', { name: /^Aplicar filtros/ }))

    expect(pushed().getAll('cor')).toEqual(['Black', 'Blue'])
  })

  it('tocar de novo desmarca só aquele', async () => {
    const painel = await abrir()

    await userEvent.click(within(painel).getByRole('button', { name: 'Black' }))
    await userEvent.click(within(painel).getByRole('button', { name: 'Blue' }))
    await userEvent.click(within(painel).getByRole('button', { name: 'Black' }))
    await userEvent.click(within(painel).getByRole('button', { name: /^Aplicar filtros/ }))

    expect(pushed().getAll('cor')).toEqual(['Blue'])
  })

  /** Seção esvaziada sai da URL, em vez de virar parâmetro vazio. */
  it('desmarcar tudo tira o parâmetro', async () => {
    search.value = new URLSearchParams('cor=Black')
    const painel = await abrir(1)

    await userEvent.click(within(painel).getByRole('button', { name: 'Black' }))
    await userEvent.click(within(painel).getByRole('button', { name: /^Aplicar filtros/ }))

    expect(pushed().getAll('cor')).toEqual([])
  })

  it('seções diferentes se somam', async () => {
    const painel = await abrir()

    await userEvent.click(within(painel).getByRole('button', { name: 'Black' }))
    await userEvent.click(within(painel).getByRole('button', { name: 'SR' }))
    await userEvent.click(within(painel).getByRole('button', { name: /^Aplicar filtros/ }))

    const params = pushed()
    expect(params.getAll('cor')).toEqual(['Black'])
    expect(params.getAll('raridade')).toEqual(['SR'])
  })
})

describe('o painel parte da URL', () => {
  it('reabre com todas as escolhas marcadas', async () => {
    search.value = new URLSearchParams('cor=Black&cor=Blue&raridade=SR')
    const painel = await abrir(3)

    for (const name of ['Black', 'Blue', 'SR']) {
      expect(within(painel).getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true')
    }
    expect(within(painel).getByRole('button', { name: 'Red' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  /** Mexer numa seção não pode apagar o que está em outra. */
  it('preserva o que não foi tocado', async () => {
    search.value = new URLSearchParams('cor=Black&raridade=SR')
    const painel = await abrir(2)

    await userEvent.click(within(painel).getByRole('button', { name: 'Blue' }))
    await userEvent.click(within(painel).getByRole('button', { name: /^Aplicar filtros/ }))

    const params = pushed()
    expect(params.getAll('cor')).toEqual(['Black', 'Blue'])
    expect(params.getAll('raridade')).toEqual(['SR'])
  })
})

describe('contagem', () => {
  /** Conta escolhas, e não seções: é o número de coisas a desfazer. */
  it('o distintivo conta cada valor', async () => {
    render(<CatalogFilters vocabulary={VOCABULARY} activeCount={3} />)

    expect(screen.getByRole('button', { name: 'Filtros, 3 ativos' })).toHaveTextContent('3')
  })

  it('limpar zera o rascunho sem navegar', async () => {
    search.value = new URLSearchParams('cor=Black&cor=Blue')
    const painel = await abrir(2)

    await userEvent.click(within(painel).getByRole('button', { name: /Limpar/ }))

    expect(within(painel).getByRole('button', { name: 'Black' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(push).not.toHaveBeenCalled()
  })
})

describe('faixas continuam com um valor só', () => {
  it('custo mínimo e máximo são um par, não uma lista', async () => {
    const painel = await abrir()

    await userEvent.type(within(painel).getByRole('spinbutton', { name: /Mínimo de custo/ }), '2')
    await userEvent.type(within(painel).getByRole('spinbutton', { name: /Máximo de custo/ }), '5')
    await userEvent.click(within(painel).getByRole('button', { name: /^Aplicar filtros/ }))

    const params = pushed()
    expect(params.getAll('custoMin')).toEqual(['2'])
    expect(params.getAll('custoMax')).toEqual(['5'])
  })
})

describe('traits', () => {
  /**
   * São milhares, então a lista não cabe como as outras seções. O que já foi
   * escolhido fica visível — sem isso, a escolha some assim que a busca muda.
   */
  it('mostra os traits escolhidos acima da busca', async () => {
    search.value = new URLSearchParams('trait=Navy')
    const painel = await abrir(1)

    expect(within(painel).getByRole('button', { name: /Navy/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('acrescenta um segundo trait sem apagar o primeiro', async () => {
    search.value = new URLSearchParams('trait=Navy')
    const painel = await abrir(1)

    await userEvent.type(within(painel).getByRole('searchbox', { name: 'Buscar trait' }), 'Straw')
    await userEvent.click(within(painel).getByRole('button', { name: 'Straw Hat Crew' }))
    await userEvent.click(within(painel).getByRole('button', { name: /^Aplicar filtros/ }))

    expect(pushed().getAll('trait')).toEqual(['Navy', 'Straw Hat Crew'])
  })
})

/**
 * O filtro por set.
 *
 * Faltava, e o relato veio da edicao em massa: guardar num binder as cartas de
 * uma colecao e de uma cor e o gesto mais comum de quem organiza. A tela 26 da
 * especificacao ja mostrava o campo.
 *
 * E lista suspensa, e nao chips: sao sessenta sets, e "as cartas de OP-09 ou de
 * OP-11" nao e uma pergunta que alguem faca.
 */
describe('filtro por set', () => {
  /**
   * O Radix so monta as opcoes depois de abrir, e num portal.
   *
   * A espera tem folga de proposito: montar o portal disputa o relogio com os
   * outros arquivos rodando em paralelo, e o padrao de um segundo ja estourou
   * uma vez sob carga.
   */
  const ESPERA = { timeout: 5000 }

  const escolher = async (painel: HTMLElement, rotulo: RegExp) => {
    await userEvent.click(within(painel).getByRole('combobox', { name: 'Set' }))
    await userEvent.click(await screen.findByRole('option', { name: rotulo }, ESPERA))
  }

  const aplicar = (painel: HTMLElement) =>
    userEvent.click(within(painel).getByRole('button', { name: /^Aplicar filtros/ }))

  it('oferece colecoes e starter decks na mesma lista', async () => {
    const painel = await abrir()
    await userEvent.click(within(painel).getByRole('combobox', { name: 'Set' }))

    const opcoes = (await screen.findAllByRole('option', undefined, ESPERA)).map(
      (o) => o.textContent,
    )
    expect(opcoes[0]).toBe('Todos os sets')
    expect(opcoes.some((o) => o?.includes('OP01') && o.includes('Coleções'))).toBe(true)
    expect(opcoes.some((o) => o?.includes('ST01') && o.includes('Starter Decks'))).toBe(true)
  })

  it('manda o codigo do set na URL', async () => {
    const painel = await abrir()

    await escolher(painel, /Straw Hat Crew/)
    await aplicar(painel)

    expect(pushed().get('set')).toBe('ST-01')
  })

  /** Um valor so: o set nao entra no "ou" das outras secoes. */
  it('escolher outro set substitui o anterior', async () => {
    search.value = new URLSearchParams('set=OP01')
    const painel = await abrir(1)

    await escolher(painel, /Straw Hat Crew/)
    await aplicar(painel)

    expect(pushed().getAll('set')).toEqual(['ST-01'])
  })

  /**
   * "Todos os sets" tem valor de sentinela, e nao string vazia: o Radix recusa
   * item com valor vazio, e o painel quebraria ao abrir.
   */
  it('voltar para todos tira o parametro', async () => {
    search.value = new URLSearchParams('set=OP01')
    const painel = await abrir(1)

    await escolher(painel, /^Todos os sets$/)
    await aplicar(painel)

    expect(pushed().getAll('set')).toEqual([])
  })

  it('combina com cor, que e o caso do relato', async () => {
    const painel = await abrir()

    await escolher(painel, /ROMANCE DAWN/)
    await userEvent.click(within(painel).getByRole('button', { name: 'Black' }))
    await aplicar(painel)

    const params = pushed()
    expect(params.get('set')).toBe('OP01')
    expect(params.getAll('cor')).toEqual(['Black'])
  })

  /** Na pagina de um set a rota ja fixa qual e, e ela vence o parametro. */
  it('some quando a rota ja fixa o set', async () => {
    render(<CatalogFilters vocabulary={VOCABULARY} activeCount={0} hideSetFilter />)
    await userEvent.click(screen.getByRole('button', { name: /Filtros/ }))
    const painel = await screen.findByRole('dialog')

    expect(within(painel).queryByRole('combobox', { name: 'Set' })).not.toBeInTheDocument()
  })
})
