import { networkInterfaces } from 'node:os'
import type { NextConfig } from 'next'

/**
 * Os enderecos por onde o servidor de desenvolvimento aceita ser aberto.
 *
 * O `next dev` recusa com **403** qualquer pedido aos arquivos internos
 * (`/_next/static/...`) vindo de uma origem que ele nao conhece. A pagina em si
 * responde 200, entao o HTML aparece e todo link funciona — e nenhum
 * JavaScript carrega.
 *
 * O sintoma disso e traicoeiro e custou uma investigacao inteira: no celular,
 * tudo que e `<a>` funcionava e tudo que e `<button>` nao. Sem erro no console,
 * porque nao ha erro: o navegador pede o script, recebe 403 e segue a vida.
 *
 * A lista sai das interfaces desta maquina, e nao de um endereco escrito a mao:
 * o IP da rede local muda quando o roteador reinicia, e um valor fixo
 * quebraria de novo no dia seguinte sem ninguem entender por que.
 *
 * So vale em desenvolvimento — em producao nao existe `allowedDevOrigins`.
 */
function localAddresses(): string[] {
  const found = new Set<string>()

  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) found.add(address.address)
    }
  }

  // `*.local` cobre o nome mDNS que o proprio aparelho resolve sozinho.
  return [...found, '*.local']
}

/**
 * A origem do Supabase Storage, quando ela existe neste ambiente.
 *
 * Sai da mesma variavel do resto do Supabase, em vez de uma lista fixa: o
 * projeto tem um endereco por ambiente, e escrever o de producao aqui faria a
 * foto enviada em desenvolvimento nao desenhar — sem erro visivel, que e como
 * a decisao 038 comecou.
 */
function supabaseImageHost() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return []

  try {
    return [
      {
        protocol: 'https' as const,
        hostname: new URL(url).hostname,
        pathname: '/storage/v1/object/public/**',
      },
    ]
  } catch {
    return []
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins: localAddresses(),
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
      // Fotos de local de armazenamento, enviadas pela propria pessoa.
      ...supabaseImageHost(),
    ],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
}

export default nextConfig
