import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Probe } from './probe'

export const metadata: Metadata = { title: 'Diagnóstico', robots: { index: false } }

/**
 * Página de diagnóstico do navegador. **Temporária.**
 *
 * Existe para responder, sem console e sem cabo, uma pergunta que só o aparelho
 * de quem relata consegue responder: o JavaScript está rodando ali?
 *
 * O sintoma que a motivou: no celular, tudo que é `<a>` funciona e tudo que é
 * `<button>` não. Navegar funciona, trocar o tema não, carregar mais não. Isso
 * é o HTML do servidor aparecendo sem o pacote do cliente subir — mas "não
 * subiu" tem várias causas, e elas se distinguem por qual das linhas falha.
 *
 * É pública de propósito: uma tela de diagnóstico atrás de login não serve para
 * diagnosticar quem não consegue usar a tela de login.
 *
 * ## O painel cinza vem de fora do React
 *
 * A linha "React hidratou" e renderizada no servidor e so vira "sim" se o
 * pacote do cliente subir — ela e confiavel nos dois sentidos. Ja "erros" era
 * renderizado pelo React, entao jurava que estava tudo bem justamente quando
 * nada estava. Quem conta isso agora e o script do `<head>`, que pendura o
 * proprio painel no fim da pagina.
 *
 * ## Sem `<script>` aqui dentro
 *
 * A primeira versão trazia a sonda num `<script>` no meio da página. Script
 * dentro de componente React não é reconciliado no cliente: ele **causa**
 * divergência de hidratação. A página passou a acusar exatamente o erro que ela
 * mesma criava — e quase me convenceu de um defeito que não existia no provedor
 * de tema. Quem registra erro agora é um script do `<head>` (ver `lib/theme.ts`);
 * daqui só se lê o que ele guardou.
 */
export default async function DiagnosticoPage() {
  const agent = (await headers()).get('user-agent') ?? '(não informado)'

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-text">Diagnóstico</h1>
        <p className="text-sm text-text-muted">
          Abra esta página no aparelho onde os botões não respondem e me diga o que aparece.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text">Navegador</h2>
        <p className="rounded-control border border-border bg-surface p-3 text-xs break-all text-text-muted">
          {agent}
        </p>
      </section>

      <Probe />
    </main>
  )
}
