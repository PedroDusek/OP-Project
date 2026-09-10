import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { hostname, networkInterfaces } from 'node:os'
import { join } from 'node:path'

/**
 * O servidor de desenvolvimento em HTTPS, alcançável pelo celular.
 *
 * ## Por que isto existe
 *
 * `navigator.share` — o que abre a folha de "enviar para" do telefone — só
 * existe em **contexto seguro**. O app aberto pelo IP da rede em `http://`, que
 * é como se testa no celular aqui, não é um: a API simplesmente não está lá, e
 * a tela cai nos botões de baixar (armadilha 48).
 *
 * Isso torna impossível conferir no aparelho o caminho mais importante da folha
 * da want list sem publicar antes. Este script resolve.
 *
 * ## Por que não `next dev --experimental-https` puro
 *
 * Porque ele gera certificado para `localhost`, e o celular não chega por
 * `localhost` — chega por `192.168.x.y`. Um certificado que não cobre o endereço
 * usado é recusado antes de qualquer pergunta ao usuário, e não há como seguir.
 *
 * Aqui o certificado sai com os endereços **desta máquina** como alternativos, e
 * eles saem das interfaces de rede e não de um valor escrito à mão: o IP muda
 * quando o roteador reinicia, e um número fixo quebraria no dia seguinte — é a
 * mesma razão que a lista de `allowedDevOrigins` já tem em `next.config.ts`.
 *
 * ## O aviso do Safari é esperado
 *
 * O certificado é assinado por ele mesmo, então o navegador avisa que não confia.
 * Em "Mostrar detalhes" dá para seguir assim mesmo. Depois disso a página é
 * HTTPS de verdade, `isSecureContext` é `true`, e o botão de compartilhar
 * aparece.
 */

const PASTA = 'certificates'
const CHAVE = join(PASTA, 'localhost-key.pem')
const CERTIFICADO = join(PASTA, 'localhost.pem')
/** Guarda para quais endereços o certificado atual foi feito. */
const REGISTRO = join(PASTA, 'enderecos.txt')

/** Os endereços IPv4 desta máquina na rede local. */
function enderecosLocais(): string[] {
  const achados = new Set<string>()

  for (const enderecos of Object.values(networkInterfaces())) {
    for (const endereco of enderecos ?? []) {
      if (endereco.family === 'IPv4' && !endereco.internal) achados.add(endereco.address)
    }
  }

  return [...achados].sort()
}

/**
 * O nome mDNS desta máquina, que o iPhone resolve sozinho.
 *
 * O Safari lida muito melhor com nome do que com IP nu, e o iOS resolve `.local`
 * nativamente por Bonjour, sem configurar nada. O `next.config.ts` já aceita
 * `*.local` em `allowedDevOrigins` — este caminho estava previsto.
 */
function nomeLocal(): string {
  return `${hostname().replace(/\.local$/i, '')}.local`
}

function nomesAlternativos(ips: readonly string[]): string {
  const entradas = [
    'DNS:localhost',
    `DNS:${nomeLocal()}`,
    'IP:127.0.0.1',
    ...ips.map((ip) => `IP:${ip}`),
  ]
  return entradas.join(',')
}

/**
 * Gera o certificado, ou reaproveita o que já serve.
 *
 * Regerar a cada execução obrigaria a aceitar o aviso do Safari toda vez, e
 * aceitar avisos de segurança por hábito é exatamente o que não se quer ensinar
 * a ninguém — nem a quem desenvolve.
 */
function garantirCertificado(ips: readonly string[]): void {
  const alternativos = `v2 ${nomesAlternativos(ips)}`

  const atual =
    existsSync(CHAVE) && existsSync(CERTIFICADO) && existsSync(REGISTRO)
      ? readFileSync(REGISTRO, 'utf8').trim()
      : null

  if (atual === alternativos) {
    console.log('[dev:https] certificado atual ja cobre estes enderecos')
    return
  }

  mkdirSync(PASTA, { recursive: true })
  console.log(`[dev:https] gerando certificado para ${alternativos}`)

  /*
   * As extensoes nao sao enfeite: sem `extendedKeyUsage=serverAuth` o iOS
   * **recusa por politica** desde a versao 13, e nesse caso o Safari nem oferece
   * o "visitar mesmo assim" — a pagina simplesmente nao abre, sem dizer por que.
   *
   * O resto tambem sai das exigencias da Apple para certificado de servidor:
   * RSA de 2048 ou mais, SHA-256, validade curta (o teto la e 825 dias) e nome
   * alternativo preenchido. Faltando qualquer uma, o desfecho e o mesmo.
   */
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey', 'rsa:2048',
      '-sha256',
      '-nodes',
      '-keyout', CHAVE,
      '-out', CERTIFICADO,
      '-days', '365',
      '-subj', '/CN=ColeXa desenvolvimento',
      '-addext', `subjectAltName=${nomesAlternativos(ips)}`,
      '-addext', 'basicConstraints=critical,CA:true',
      '-addext', 'keyUsage=critical,digitalSignature,keyCertSign,keyEncipherment',
      '-addext', 'extendedKeyUsage=serverAuth',
    ],
    { stdio: 'inherit' },
  )

  writeFileSync(REGISTRO, `${alternativos}\n`, 'utf8')
}

/** A porta esta livre? */
function portaLivre(porta: number): Promise<boolean> {
  return new Promise((resolve) => {
    const servidor = createServer()
    servidor.once('error', () => resolve(false))
    servidor.once('listening', () => servidor.close(() => resolve(true)))
    servidor.listen(porta)
  })
}

async function main(): Promise<void> {
  const porta = Number(process.env.PORT ?? 3000)

  /*
   * O Next recusa subir um segundo servidor de desenvolvimento, e a mensagem
   * dele aparece depois de o script ja ter impresso os enderecos — que ficariam
   * apontando para uma porta que este processo nao vai usar.
   *
   * Parar aqui, com a instrucao, e melhor que subir na porta seguinte e mandar
   * a pessoa para um endereco errado.
   */
  if (!(await portaLivre(porta))) {
    console.error(`[dev:https] a porta ${porta} esta ocupada.`)
    console.error('[dev:https] pare o `npm run dev` que ja esta rodando e tente de novo.')
    process.exit(1)
  }

  const ips = enderecosLocais()

  if (ips.length === 0) {
    console.warn(
      '[dev:https] nenhuma interface de rede encontrada — o certificado vai cobrir so localhost',
    )
  }

  garantirCertificado(ips)

  console.log('')
  console.log('[dev:https] no celular, abra e siga o aviso do Safari:')
  console.log(`             https://${nomeLocal()}:${porta}`)
  for (const ip of ips) console.log(`             https://${ip}:${porta}`)
  console.log('')

  /*
   * `--experimental-https` vai junto, e nao e redundante: sozinhos, `-key` e
   * `-cert` nao ligam o HTTPS. O servidor sobe em `http://` sem reclamar de
   * nada, e o unico sinal e a linha "Local: http://" no meio do log — que e
   * facil de ler por cima quando se esta esperando o endereco.
   */
  const next = spawn(
    'npx',
    [
      'next',
      'dev',
      '--experimental-https',
      '--experimental-https-key', CHAVE,
      '--experimental-https-cert', CERTIFICADO,
    ],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  )

  next.on('exit', (codigo) => process.exit(codigo ?? 0))
}

void main()
