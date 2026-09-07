import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { enabledOAuthProviders } from '@/server/application/auth'
import { currentViewer } from '@/server/http/viewer'
import { SignInForm } from './sign-in-form'

export const metadata: Metadata = { title: 'Entrar' }

export default async function EntrarPage({ searchParams }: PageProps<'/entrar'>) {
  // Quem já tem sessão não vê a tela de login: ela só ofereceria fazer de novo
  // o que já está feito.
  if (await currentViewer()) redirect('/inicio')

  const params = await searchParams
  const next = typeof params.next === 'string' ? params.next : undefined
  const erro = typeof params.erro === 'string' ? params.erro : undefined

  return <SignInForm providers={await enabledOAuthProviders()} next={next} initialError={erro} />
}
