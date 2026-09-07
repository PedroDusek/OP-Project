import { SupabaseSessionProvider } from '@/server/infrastructure/auth/supabase-session-provider'
import {
  SupabaseAuthProvider,
  SupabaseOAuthAvailability,
} from '@/server/infrastructure/auth/supabase-auth-provider'
import { prisma } from '@/server/infrastructure/prisma'
import type { SessionProvider } from '@/server/http/session-provider'
import type {
  AuthProvider,
  CookieStore,
  OAuthAvailability,
  OAuthProviderId,
} from '@/server/http/auth-provider'
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

let sessionOverride: SessionProvider | null = null
let sessionFallback: SessionProvider | null = null

/** Substitui o provedor de sessao. Passe `null` para voltar ao padrao real. */
export function setSessionProvider(provider: SessionProvider | null): void {
  sessionOverride = provider
}

export function activeSessionProvider(): SessionProvider {
  if (sessionOverride) return sessionOverride
  sessionFallback ??= new SupabaseSessionProvider()
  return sessionFallback
}

export async function userFromRequest(request: Request): Promise<AuthenticatedUser | null> {
  const identity = await activeSessionProvider().identify(request)
  if (!identity) return null
  return resolveUser(prisma, identity)
}

/**
 * O provedor de credencial depende do armazenamento de cookie da requisicao, e
 * por isso e construido a cada uso em vez de guardado. A fabrica e substituivel
 * inteira nos testes.
 */
let authFactory: ((cookies: CookieStore) => AuthProvider) | null = null

export function setAuthProviderFactory(
  factory: ((cookies: CookieStore) => AuthProvider) | null,
): void {
  authFactory = factory
}

export function activeAuthProvider(cookies: CookieStore): AuthProvider {
  return authFactory ? authFactory(cookies) : new SupabaseAuthProvider(cookies)
}

let availabilityOverride: OAuthAvailability | null = null
let availabilityFallback: OAuthAvailability | null = null

export function setOAuthAvailability(availability: OAuthAvailability | null): void {
  availabilityOverride = availability
}

export async function enabledOAuthProviders(): Promise<OAuthProviderId[]> {
  if (availabilityOverride) return availabilityOverride.enabledProviders()
  availabilityFallback ??= new SupabaseOAuthAvailability()
  return availabilityFallback.enabledProviders()
}

export type { AuthenticatedUser }
