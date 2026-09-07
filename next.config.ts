import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    /**
     * A imagem de carta passa pelo nosso servidor porque **nao ha alternativa**.
     *
     * O servidor da Bandai responde com `cross-origin-resource-policy:
     * same-site` em toda imagem do catalogo. Isso instrui o navegador a recusar
     * exibi-la em qualquer origem que nao seja a deles — nao e configuracao
     * nossa, nao ha cabecalho que contorne, e vale para localhost e para
     * colexa.com.br igualmente. As quatro origens deles foram testadas.
     *
     * Referenciar direto, como a decisao 026 previa, simplesmente nao desenha a
     * imagem. Ver a decisao 038.
     *
     * `minimumCacheTTL` de 30 dias e o que torna isto **mais leve** para a
     * fonte do que a alternativa: sem cache, cada visitante geraria uma
     * requisicao a Bandai por carta vista.
     */
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'en.onepiece-cardgame.com',
        pathname: '/images/cardlist/**',
      },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
}

export default nextConfig
