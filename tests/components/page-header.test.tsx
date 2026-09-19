import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '@/components/layout/app-shell'

/**
 * O voltar de toda tela (pedido do dono do produto em 18/09). O destino é fixo,
 * e não o histórico: quem chega por link compartilhado não tem para onde voltar
 * dentro do ColeXa.
 */
describe('PageHeader', () => {
  it('mostra o voltar com o destino e o nome dito ao leitor de tela', () => {
    render(<PageHeader title="Binders" back={{ href: '/inicio', label: 'o Início' }} />)

    const voltar = screen.getByRole('link', { name: 'Voltar para o Início' })
    expect(voltar).toHaveAttribute('href', '/inicio')
    expect(screen.getByRole('heading', { level: 1, name: 'Binders' })).toBeInTheDocument()
  })

  /* O Início é a raiz: é a única tela sem voltar. */
  it('não inventa um voltar quando a tela não pede', () => {
    render(<PageHeader title="Olá, Pedro" />)

    expect(screen.queryByRole('link', { name: /voltar/i })).not.toBeInTheDocument()
  })
})

/**
 * A guarda: toda página do app tem voltar (decisão 101).
 *
 * O dono do produto achou uma tela sem voltar depois da primeira revisão, e
 * pediu garantia. Revisar a olho não garante a próxima tela que alguém criar;
 * este teste garante. Ele lê o código de cada `page.tsx` e procura uma das
 * formas de voltar que o projeto usa.
 *
 * Fica de fora só o Início, que é a raiz. As telas de conta têm o voltar na
 * moldura (`(auth)/layout.tsx`), e as públicas estão listadas abaixo.
 */
describe('toda tela tem voltar', () => {
  const FORMAS_DE_VOLTAR = /back=\{|<BackButton|<SetHeader|<LocationHeader|<ArrowLeft|<LegalPending/
  const SEM_VOLTAR = new Set([
    // A raiz do app.
    '(app)/inicio/page.tsx',
    // A porta de entrada pública, e o Trade Binder aberto por link de fora.
    '(marketing)/page.tsx',
    'trade/[token]/page.tsx',
    // O guia de estilo e as ferramentas de desenvolvimento, fora do produto.
    'design-system/page.tsx',
  ])

  function paginas(dir: string): string[] {
    return readdirSync(dir).flatMap((nome) => {
      const caminho = path.join(dir, nome)
      if (statSync(caminho).isDirectory()) return paginas(caminho)
      return nome === 'page.tsx' ? [caminho] : []
    })
  }

  const raiz = path.join(process.cwd(), 'src', 'app')
  const todas = paginas(raiz)
    .map((arquivo) => path.relative(raiz, arquivo).split(path.sep).join('/'))
    .filter((rel) => !rel.startsWith('dev/'))

  it('encontra as páginas', () => {
    expect(todas.length).toBeGreaterThan(30)
  })

  it.each(todas.filter((rel) => !rel.startsWith('(auth)/') && !SEM_VOLTAR.has(rel)))(
    '%s tem voltar',
    (rel) => {
      expect(readFileSync(path.join(raiz, rel), 'utf8')).toMatch(FORMAS_DE_VOLTAR)
    },
  )

  it('as telas de conta têm o voltar na moldura', () => {
    expect(readFileSync(path.join(raiz, '(auth)', 'layout.tsx'), 'utf8')).toMatch(/<ArrowLeft/)
  })
})