import { SupabaseSessionProvider } from '@/server/infrastructure/auth/supabase-session-provider'
import { prisma } from '@/server/infrastructure/prisma'
import type { SessionProvider } from '@/server/http/session-provider'
import { resolveUser, type AuthenticatedUser } from './resolve-user'

/**
 * Composicao da autenticacao.
 *
 * Camada: application, a unica que pode falar com infrastructure.
 *
 * O provedor real e o padrao, construido sob demanda: uma rota nao precisa
 * lembrar de configurar nada, e esquecer nao produz uma aplicacao sem
 * autenticacao. Os testes substituem por um provedor falso e nao tocam a rede.
 */

let override: SessionProvider | null = null
let fallback: SessionProvider | null = null

/** Substitui o provedor. Passe `null` para voltar ao padrao real. */
export function setSessionProvider(provider: SessionProvider | null): void {
  override = provider
}

export function activeSessionProvider(): SessionProvider {
  if (override) return override
  fallback ??= new SupabaseSessionProvider()
  return fallback
}

export async function userFromRequest(request: Request): Promise<AuthenticatedUser | null> {
  const identity = await activeSessionProvider().identify(request)
  if (!identity) return null
  return resolveUser(prisma, identity)
}

export type { AuthenticatedUser }
