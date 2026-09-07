import type { MetadataRoute } from 'next'

/**
 * Manifesto de aplicativo instalavel.
 *
 * O produto e mobile-first e as pessoas vao usa-lo em pe, numa loja ou num
 * evento, com o celular na mao. Sem manifesto, adicionar a tela inicial gera um
 * atalho com o icone errado que abre dentro do navegador, com barra de endereco
 * ocupando altura que a grade de cartas precisa.
 *
 * `background_color` e o fundo claro da marca: e a cor da tela de abertura,
 * pintada pelo sistema antes de qualquer CSS existir, entao ela nao pode
 * depender de token.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ColeXa',
    short_name: 'ColeXa',
    description: 'Sua coleção. Do seu jeito.',
    start_url: '/inicio',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F2F2F3',
    theme_color: '#38287B',
    lang: 'pt-BR',
    icons: [
      { src: '/marca/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/marca/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
