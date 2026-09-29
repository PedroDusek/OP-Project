import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CatalogSort } from '@/components/catalog/catalog-sort'
import type { CatalogSearchParams } from '@/lib/catalog-params'

/**
 * A escolha da ordem, fora do painel de filtros (decisão 110).
 *
 * Ela nasceu dentro do painel e o dono do produto pediu para tirá-la de lá
 * (23/09): ordenar não é filtrar, e mexer nos filtros não pode desfazer a
 * ordem. Que o painel a preserva está em `catalog-filters.test.tsx`; aqui está
 * o controle em si.
 */

const push = vi.hoisted(() => vi.fn())
const search = vi.hoisted(() => ({ value: new URLSearchParams() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/catalogo',
  useSearchParams: () => search.value,
}))

/*
 * A espera tem folga de proposito: montar o portal do Radix disputa o relogio
 * com os outros arquivos rodando em paralelo.
 */
const ESPERA = { timeout: 5000 }

beforeEach(() => {
  search.value = new URLSearchParams()
})

afterEach(() => {
  push.mockClear()
})

/** A URL que o controle mandou navegar, ja como parametros. */
function pushed(): URLSearchParams {
  const href = String(push.mock.calls[0][0])
  return new URLSearchParams(href.slice(href.indexOf('?') + 1))
}

const escolher = async (rotulo: RegExp) => {
  await userEvent.click(screen.getByRole('combobox', { name: 'Ordenar por' }))
  await userEvent.click(await screen.findByRole('option', { name: rotulo }, ESPERA))
}

describe('o controle de ordem', () => {
  it('oferece as sete ordens, comecando pela padrao', async () => {
    render(<CatalogSort />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Ordenar por' }))

    const opcoes = (await screen.findAllByRole('option', undefined, ESPERA)).map((o) => o.textContent)
    expect(opcoes).toEqual([
      'Código do set',
      'Nome (A → Z)',
      'Nome (Z → A)',
      'Custo (menor primeiro)',
      'Custo (maior primeiro)',
      'Poder (menor primeiro)',
      'Poder (maior primeiro)',
    ])
  })

  it('mostra a ordem que ja esta aplicada', () => {
    search.value = new URLSearchParams('ordem=nome-desc')
    render(<CatalogSort />)

    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveTextContent('Nome (Z → A)')
  })

  it('escolher navega na hora, sem precisar aplicar', async () => {
    render(<CatalogSort />)

    await escolher(/Custo \(maior primeiro\)/)

    expect(push).toHaveBeenCalledTimes(1)
    expect(pushed().get('ordem')).toBe('custo-desc')
  })

  /*
   * `?ordem=codigo` diz o mesmo que nao dizer nada, e um endereco compartilhado
   * fica mais limpo sem ele.
   */
  it('a ordem padrao nao vai escrita na URL', async () => {
    search.value = new URLSearchParams('ordem=custo-desc')
    render(<CatalogSort />)

    await escolher(/Código do set/)

    expect(pushed().has('ordem')).toBe(false)
  })

  /* Mudar a ordem nao pode apagar o filtro que ja estava na URL. */
  it('preserva os filtros que ja estavam na URL', async () => {
    search.value = new URLSearchParams('cor=Blue&tipo=Character')
    render(<CatalogSort />)

    await escolher(/Nome \(A → Z\)/)

    const params = pushed()
    expect(params.get('cor')).toBe('Blue')
    expect(params.get('tipo')).toBe('Character')
    expect(params.get('ordem')).toBe('nome')
  })

  /* Trocar a ordem volta para a pagina 1: a leva de antes nao vale mais. */
  it('volta para a primeira pagina', async () => {
    search.value = new URLSearchParams('pagina=7')
    render(<CatalogSort />)

    await escolher(/Poder \(maior primeiro\)/)

    expect(pushed().has('pagina')).toBe(false)
  })
})

/**
 * Nas telas onde os filtros são estado local — Deck Builder e seletor de cartas
 * —, a escolha volta para quem chamou em vez de navegar.
 */
describe('quando os filtros nao moram na URL', () => {
  it('devolve a ordem sem apagar os filtros que ja havia', async () => {
    const onChange = vi.fn()
    const values: CatalogSearchParams = { cor: ['Blue'], tipo: 'Character' }
    render(<CatalogSort values={values} onChange={onChange} />)

    await escolher(/Custo \(menor primeiro\)/)

    expect(push).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith({ cor: ['Blue'], tipo: 'Character', ordem: 'custo' })
  })

  it('le a ordem atual de quem chamou, e nao da URL', () => {
    search.value = new URLSearchParams('ordem=custo-desc')
    render(<CatalogSort values={{ ordem: 'nome' }} onChange={vi.fn()} />)

    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveTextContent('Nome (A → Z)')
  })

  it('a ordem padrao volta como indefinida, para nao virar parametro vazio', async () => {
    const onChange = vi.fn()
    render(<CatalogSort values={{ ordem: 'nome' }} onChange={onChange} />)

    await escolher(/Código do set/)

    expect(onChange).toHaveBeenCalledWith({ ordem: undefined })
  })
})
