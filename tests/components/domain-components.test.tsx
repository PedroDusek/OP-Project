import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardTile } from '@/components/catalog/card-tile'
import { StorageCard } from '@/components/storage/storage-card'
import { StatusBadge } from '@/components/ui/badge'
import { Avatar, initialsOf } from '@/components/ui/avatar'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Switch } from '@/components/ui/switch'

describe('CardTile', () => {
  /**
   * A imagem vem da origem, sem passar pelo nosso servidor: a decisao 020 manda
   * referenciar e nunca copiar, e o otimizador do `next/image` copiaria. O teste
   * fixa que a URL exibida e a que entrou.
   */
  it('referencia a imagem na origem, com carregamento tardio', () => {
    render(
      <CardTile
        code="OP01-001"
        name="Roronoa Zoro"
        imageUrl="https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png"
        quantity={4}
      />,
    )

    const image = screen.getByRole('img', { name: 'OP01-001 — Roronoa Zoro' })
    expect(image).toHaveAttribute(
      'src',
      'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png',
    )
    expect(image).toHaveAttribute('loading', 'lazy')
  })

  it('mostra o codigo quando nao ha imagem', () => {
    render(<CardTile code="OP01-002" name="Nami" imageUrl={null} />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getAllByText('OP01-002').length).toBeGreaterThan(0)
  })

  it('mostra a quantidade possuida, inclusive zero', () => {
    const { rerender } = render(
      <CardTile code="OP01-003" name="Sanji" imageUrl={null} quantity={3} />,
    )
    expect(screen.getByText('x3')).toBeInTheDocument()

    rerender(<CardTile code="OP01-003" name="Sanji" imageUrl={null} quantity={0} />)
    expect(screen.getByText('x0')).toBeInTheDocument()
  })

  it('expoe a selecao da edicao em massa', async () => {
    const onClick = vi.fn()
    render(
      <CardTile
        code="OP01-004"
        name="Chopper"
        imageUrl={null}
        selectable
        selected
        onClick={onClick}
      />,
    )

    const tile = screen.getByRole('button')
    expect(tile).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(tile)
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('StorageCard', () => {
  it('mostra tipo e finalidade de binder e caixa', () => {
    render(<StorageCard name="Binder Troca" type="BINDER" purpose="TRADE" cardCount={32} />)

    expect(screen.getByText('Binder • Troca')).toBeInTheDocument()
    expect(screen.getByText('32 cartas')).toBeInTheDocument()
  })

  /**
   * Deck nao tem finalidade (`business-rules.md` 3.1). Escrever
   * "Deck • Coleção" seria inventar um dado que o banco recusa por `CHECK`.
   */
  it('nao inventa finalidade para deck', () => {
    render(<StorageCard name="Deck Sabo" type="DECK" cardCount={50} />)

    expect(screen.getByText('Deck')).toBeInTheDocument()
    expect(screen.queryByText(/Deck •/)).not.toBeInTheDocument()
  })

  it('usa singular para uma carta', () => {
    render(<StorageCard name="Caixa" type="BOX" purpose="COLLECTION" cardCount={1} />)

    expect(screen.getByText('1 carta')).toBeInTheDocument()
  })
})

describe('StatusBadge', () => {
  it('escreve o estado, sem depender da cor', () => {
    render(
      <>
        <StatusBadge status="NEGOTIATING" />
        <StatusBadge status="COMPLETED" />
        <StatusBadge status="CANCELLED" />
      </>,
    )

    expect(screen.getByText('Em negociação')).toBeInTheDocument()
    expect(screen.getByText('Concluída')).toBeInTheDocument()
    expect(screen.getByText('Cancelada')).toBeInTheDocument()
  })
})

describe('Avatar', () => {
  it('deriva as iniciais do primeiro e do ultimo nome', () => {
    expect(initialsOf('Pedro Dusek')).toBe('PD')
    expect(initialsOf('Pedro Henrique Dusek')).toBe('PD')
    expect(initialsOf('Pedro')).toBe('PE')
    expect(initialsOf('  ')).toBe('?')
  })

  it('e decorativo: o nome ja aparece ao lado', () => {
    const { container } = render(<Avatar name="Pedro Dusek" />)

    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('estados obrigatorios', () => {
  it('o vazio explica o vazio e aponta a proxima acao', () => {
    render(
      <EmptyState
        title="Nenhuma carta ainda"
        description="Tudo o que você adicionar aparece aqui."
        action={{ label: 'Abrir o catálogo', href: '/catalogo' }}
      />,
    )

    expect(screen.getByText('Nenhuma carta ainda')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir o catálogo' })).toHaveAttribute(
      'href',
      '/catalogo',
    )
  })

  it('o erro anuncia sozinho e oferece nova tentativa', async () => {
    const onRetry = vi.fn()
    render(<ErrorState description="Verifique sua conexão." onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar')

    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('Switch', () => {
  it('o rotulo faz parte do alvo', async () => {
    const onCheckedChange = vi.fn()
    render(
      <Switch
        checked={false}
        onCheckedChange={onCheckedChange}
        label="Definir como disponível para troca"
      />,
    )

    await userEvent.click(screen.getByText('Definir como disponível para troca'))

    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })
})
