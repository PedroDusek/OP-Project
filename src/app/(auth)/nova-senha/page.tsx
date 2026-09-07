import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentViewer } from '@/server/http/viewer'
import { NewPasswordForm } from './new-password-form'

export const metadata: Metadata = { title: 'Nova senha' }

/**
 * Definir a senha nova.
 *
 * Só faz sentido para quem chegou pelo link de redefinição, que criou uma
 * sessão ao passar por `/auth/callback`. Sem sessão não há a quem trocar a
 * senha, e a tela manda de volta para o pedido — a alternativa seria um
 * formulário que só falha depois de a pessoa digitar duas vezes.
 */
export default async function NovaSenhaPage() {
  if (!(await currentViewer())) redirect('/recuperar-senha?expirado=1')

  return <NewPasswordForm />
}
