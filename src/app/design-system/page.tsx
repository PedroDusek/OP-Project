import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { Guide } from './guide'

export const metadata: Metadata = {
  title: 'Guia de estilo',
  // Pagina interna de revisao: nao deve aparecer em busca.
  robots: { index: false, follow: false },
}

/**
 * Guia de estilo.
 *
 * Existe para uma coisa que teste automatizado nao faz: alguem olhar. Os testes
 * confirmam comportamento e acessibilidade, mas se o roxo ficou pesado demais
 * num botao, se o contraste do texto secundario cai no tema escuro, ou se dois
 * componentes discordam do mesmo raio, quem percebe e o olho — e so se todos
 * estiverem na mesma tela.
 *
 * Fica fora da navegacao e fora dos buscadores. Antes de publicar o produto,
 * decidir se ela continua acessivel e uma escolha consciente, nao um
 * esquecimento.
 *
 * Renderiza **dentro do shell**, e nao solta numa pagina propria, por dois
 * motivos. Ver um componente isolado nao diz se ele convive com a barra
 * inferior e com a coluna lateral, que e onde os problemas de espaco aparecem.
 * E, por nao exigir sessao, esta e a unica rota em que o comportamento
 * responsivo do shell pode ser medido sem uma conta — que e o que
 * `tests/e2e/responsive.spec.ts` faz.
 */
export default function DesignSystemPage() {
  return (
    <AppShell>
      <Guide />
    </AppShell>
  )
}
