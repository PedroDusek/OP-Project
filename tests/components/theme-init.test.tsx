import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ThemeInit } from '@/components/theme/theme-init'

/**
 * O script de tema, no navegador.
 *
 * A metade que este arquivo protege e a que existe por causa de um defeito
 * concreto: uma tag `<script>` deixada na arvore do React faz o React reclamar
 * a cada navegacao de cliente — *"scripts inside React components are never
 * executed when rendering on the client"* — e o painel de desenvolvimento do
 * Next enche de erro. Dois por navegacao, medidos.
 *
 * A tag so tem serventia quando o navegador ainda vai analisar o HTML, ou seja,
 * na renderizacao do servidor. Isso esta em `tests/unit/theme-init.test.ts`.
 */

describe('renderizacao no navegador', () => {
  it('nao renderiza nada', () => {
    const { container } = render(<ThemeInit />)

    expect(container.innerHTML).toBe('')
  })

  /** O que faz o React reclamar e exatamente a existencia da tag. */
  it('nao deixa tag de script na arvore', () => {
    const { container } = render(<ThemeInit />)

    expect(container.querySelector('script')).toBeNull()
  })
})
