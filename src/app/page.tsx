import { redirect } from 'next/navigation'

/**
 * A raiz.
 *
 * Hoje leva ao Início. A landing publica (tela 02) e as telas de entrada
 * chegam com a autenticacao na interface, e e ela que vai ocupar `/` para quem
 * nao tem sessao.
 */
export default function RootPage() {
  redirect('/inicio')
}
