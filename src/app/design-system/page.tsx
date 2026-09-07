import type { Metadata } from 'next'
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
 */
export default function DesignSystemPage() {
  return <Guide />
}
