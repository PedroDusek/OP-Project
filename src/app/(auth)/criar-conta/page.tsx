import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { enabledOAuthProviders } from '@/server/application/auth'
import { currentViewer } from '@/server/http/viewer'
import { SignUpForm } from './sign-up-form'

export const metadata: Metadata = { title: 'Criar conta' }

export default async function CriarContaPage() {
  if (await currentViewer()) redirect('/inicio')

  return <SignUpForm providers={await enabledOAuthProviders()} />
}
