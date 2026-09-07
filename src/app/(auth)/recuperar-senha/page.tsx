import type { Metadata } from 'next'
import { PasswordResetForm } from './password-reset-form'

export const metadata: Metadata = { title: 'Recuperar senha' }

export default function RecuperarSenhaPage() {
  return <PasswordResetForm />
}
