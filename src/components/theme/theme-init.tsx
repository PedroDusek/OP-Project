'use client'

import { THEME_INIT_SCRIPT } from '@/lib/theme'

/**
 * O script que aplica o tema antes da primeira pintura.
 *
 * ## Por que ele existe
 *
 * Sem ele a pagina aparece no tema do sistema e so troca para o tema escolhido
 * quando o React hidrata — o flash branco de sempre. Nao da para resolver com
 * `useEffect`, que por definicao roda depois da pintura: tem que ser sincrono,
 * no `<head>`, antes de o `<body>` existir.
 *
 * ## Por que e um componente de cliente que quase nunca renderiza nada
 *
 * Uma tag `<script>` escrita direto no layout resolve a pintura e cria outro
 * problema: em cada navegacao de cliente o React reconcilia o layout raiz,
 * encontra a tag e reclama — *"scripts inside React components are never
 * executed when rendering on the client"*. Sao dois erros por navegacao no
 * painel de desenvolvimento, e um painel barulhento e um painel que ninguem le.
 *
 * A tag so tem serventia na renderizacao do servidor, que e quando o navegador
 * ainda vai analisar o HTML. Entao e exatamente ai que ela e emitida, e no
 * cliente o componente devolve nada.
 *
 * O `<head>` do layout carrega `suppressHydrationWarning` porque servidor e
 * cliente divergem aqui de proposito.
 *
 * ## O que foi tentado e nao serve
 *
 * `next/script` com `beforeInteractive` **nao inlina o codigo**: ele empilha o
 * conteudo em `self.__next_s`, que a runtime do Next processa depois de o
 * pacote carregar. Isso e tarde demais — o flash volta. Serve para script de
 * terceiro que precisa preceder a hidratacao, nao para mexer no DOM antes da
 * pintura.
 */
export function ThemeInit() {
  if (typeof window !== 'undefined') return null

  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
}
