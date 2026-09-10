import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ACCOUNT, DESTINATIONS, activeDestination } from '@/components/layout/navigation'
import { NavDrawer } from '@/components/layout/nav-drawer'
import { SideNav } from '@/components/layout/side-nav'

const pathname = vi.hoisted(() => ({ value: '/inicio' }))
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }))

describe('activeDestination', () => {
  it('reconhece a rota exata', () => {
    expect(activeDestination('/colecao')?.label).toBe('Coleção')
  })

  /**
   * Casar por prefixo e o que mantem "Catálogo" aceso dentro de
   * `/catalogo/OP01`. Comparando por igualdade, a barra ficaria sem nenhum item
   * ativo assim que alguem abrisse qualquer detalhe.
   */
  it('mantem a secao ativa nas rotas filhas', () => {
    expect(activeDestination('/catalogo/OP01-001')?.label).toBe('Catálogo')
  })

  it('nao casa por prefixo de texto solto', () => {
    expect(activeDestination('/colecaozinha')).toBeUndefined()
  })

  it('devolve indefinido fora das secoes', () => {
    expect(activeDestination('/design-system')).toBeUndefined()
  })

  it('reconhece a conta, que fica fora da lista de destinos', () => {
    expect(activeDestination('/conta')?.label).toBe('Minha conta')
  })
})

describe('NavDrawer', () => {
  /**
   * A gaveta e o que destravou passar de cinco destinos: a barra inferior
   * tinha teto porque seis alvos a 360 px dao 60 px cada, e aqui cada linha
   * tem a altura de uma lista.
   */
  it('lista todos os destinos e a conta', async () => {
    pathname.value = '/inicio'
    render(<NavDrawer />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir o menu' }))

    for (const destination of [...DESTINATIONS, ACCOUNT]) {
      expect(screen.getByRole('link', { name: destination.label })).toHaveAttribute(
        'href',
        destination.href,
      )
    }
  })

  /** Fechada, ela nao poe link nenhum na arvore: nao ha o que tabular por tras. */
  it('nao expoe os destinos enquanto esta fechada', () => {
    pathname.value = '/inicio'
    render(<NavDrawer />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  /**
   * `aria-current` e o que faz o leitor de tela dizer "pagina atual" em vez de
   * mais um link — a cor sozinha nao chega ate ele.
   */
  it('marca a secao ativa com aria-current', async () => {
    pathname.value = '/colecao'
    render(<NavDrawer />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir o menu' }))

    expect(screen.getByRole('link', { name: 'Coleção' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current')
  })

  /** Sem isto ela ficaria aberta sobre a tela nova. */
  it('fecha ao escolher um destino', async () => {
    pathname.value = '/inicio'
    render(<NavDrawer />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir o menu' }))
    await userEvent.click(screen.getByRole('link', { name: 'Coleção' }))

    expect(screen.queryByRole('link', { name: 'Coleção' })).not.toBeInTheDocument()
  })
})

describe('SideNav', () => {
  it('usa os mesmos destinos, na mesma ordem', () => {
    pathname.value = '/binders'
    render(<SideNav />)

    const links = screen.getAllByRole('link')
    // O primeiro link e a marca, que leva ao inicio.
    expect(links[0]).toHaveAttribute('href', '/inicio')
    // A marca, os destinos, e a conta no rodape.
    expect(links.slice(1).map((link) => link.getAttribute('href'))).toEqual([
      ...DESTINATIONS.map((destination) => destination.href),
      ACCOUNT.href,
    ])
  })

  it('marca a secao ativa com aria-current', () => {
    pathname.value = '/binders'
    render(<SideNav />)

    expect(screen.getByRole('link', { name: 'Binders' })).toHaveAttribute('aria-current', 'page')
  })

  /**
   * Trocas ficava fora da barra por falta de vaga; com a gaveta, nenhum destino
   * fica escondido (decisao 061). O teste virou o contrario do que era.
   */
  it('nao esconde mais nenhum destino', () => {
    pathname.value = '/trocas'
    render(<SideNav />)

    expect(screen.getByRole('link', { name: 'Trocas' })).toHaveAttribute('href', '/trocas')
    expect(screen.getByRole('link', { name: 'Social' })).toHaveAttribute('href', '/social')
  })

  /** A conta fica separada dos destinos, no rodape. */
  it('leva para a conta', () => {
    pathname.value = '/conta'
    render(<SideNav />)

    expect(screen.getByRole('link', { name: 'Minha conta' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
