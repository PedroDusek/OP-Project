import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

// As barras leem a rota atual para marcar o destino ativo. Fora do roteador
// `usePathname` devolve nulo, e elas quebram antes de renderizar.
vi.mock('next/navigation', () => ({ usePathname: () => '/inicio' }))

import { SideNav } from '@/components/layout/side-nav'
import { TopBar } from '@/components/layout/top-bar'

/**
 * A impressao e do conteudo, nao do aplicativo.
 *
 * A folha da want list saia com a barra inferior atravessada por cima das
 * cartas. Nao e detalhe estetico: barra `fixed` imprime em **toda** pagina,
 * sobre o conteudo, e come uma faixa de cada folha.
 *
 * A barra inferior deixou de existir (decisao 061); a gaveta que a substituiu
 * so aparece aberta, e fechada nao poe nada na folha.
 *
 * O teste olha a classe, e nao o estilo aplicado: o jsdom nao avalia media
 * query, entao pintar em `print` e invisivel para ele. Que o Tailwind emite a
 * regra dentro de `@media print` foi conferido no CSS compilado.
 */

const chrome: [string, () => React.ReactElement][] = [
  ['barra lateral', () => <SideNav />],
  ['barra superior', () => <TopBar />],
]

describe('a navegacao nao entra na folha', () => {
  for (const [nome, render_] of chrome) {
    it(`esconde a ${nome} na impressao`, () => {
      const { container } = render(render_())
      const raiz = container.firstElementChild

      expect(raiz?.className).toContain('print:hidden')
    })
  }
})
