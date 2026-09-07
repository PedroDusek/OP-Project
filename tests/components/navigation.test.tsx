import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DESTINATIONS, activeDestination } from '@/components/layout/navigation'
import { BottomNav } from '@/components/layout/bottom-nav'
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
})

describe('BottomNav', () => {
  it('lista os cinco destinos da especificacao', () => {
    pathname.value = '/inicio'
    render(<BottomNav />)

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(DESTINATIONS.length)
    expect(nav).toBeInTheDocument()

    for (const destination of DESTINATIONS) {
      expect(screen.getByRole('link', { name: destination.label })).toHaveAttribute(
        'href',
        destination.href,
      )
    }
  })

  /**
   * Secao 4: a barra identifica claramente a secao ativa. `aria-current` e o
   * que faz o leitor de tela dizer "pagina atual" em vez de mais um link — a
   * cor sozinha nao chega ate ele.
   */
  it('marca a secao ativa com aria-current', () => {
    pathname.value = '/colecao'
    render(<BottomNav />)

    expect(screen.getByRole('link', { name: 'Coleção' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current')
  })
})

describe('SideNav', () => {
  it('usa os mesmos destinos, na mesma ordem', () => {
    pathname.value = '/binders'
    render(<SideNav />)

    const links = screen.getAllByRole('link')
    // O primeiro link e a marca, que leva ao inicio.
    expect(links[0]).toHaveAttribute('href', '/inicio')
    expect(links.slice(1).map((link) => link.getAttribute('href'))).toEqual(
      DESTINATIONS.map((destination) => destination.href),
    )
  })

  it('marca a secao ativa com aria-current', () => {
    pathname.value = '/binders'
    render(<SideNav />)

    expect(screen.getByRole('link', { name: 'Binders' })).toHaveAttribute('aria-current', 'page')
  })

  /**
   * Trocas saiu da barra para ela ficar em cinco, mas continua sendo uma secao:
   * `activeDestination` precisa reconhece-la, senao quem entra em `/trocas` nao
   * ve nada marcado em lugar nenhum.
   */
  it('reconhece a secao que ficou fora da barra', () => {
    pathname.value = '/trocas'
    render(<SideNav />)

    expect(screen.queryByRole('link', { name: 'Trocas' })).not.toBeInTheDocument()
    expect(activeDestination('/trocas')?.label).toBe('Trocas')
  })
})
