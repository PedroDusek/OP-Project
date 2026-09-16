import { prisma } from '@/server/infrastructure/prisma'
import type { AuthenticatedUser } from '@/server/application/auth'
import {
  blockMember as blockMemberWith,
  listBlockedMembers as listBlockedMembersWith,
  listNetwork as listNetworkWith,
  readMemberBinder as readMemberBinderWith,
  reportMember as reportMemberWith,
  unblockMember as unblockMemberWith,
} from './network'
import { listReports as listReportsWith } from './reports'
import {
  getUsernameState as getUsernameStateWith,
  setUsername as setUsernameWith,
} from './set-username'

/**
 * Ponto de composicao dos casos de uso da rede.
 *
 * Camada: application, a unica que pode falar com infrastructure.
 */

export function getUsernameState(user: AuthenticatedUser) {
  return getUsernameStateWith(prisma, user)
}

export function setUsername(user: AuthenticatedUser, raw: string) {
  return setUsernameWith(prisma, user, raw)
}

export function listNetwork(user: AuthenticatedUser, options: { page?: string | null; query?: string | null } = {}) {
  return listNetworkWith(prisma, user, options)
}

export function readMemberBinder(user: AuthenticatedUser, username: string) {
  return readMemberBinderWith(prisma, user, username)
}

export function blockMember(user: AuthenticatedUser, username: string) {
  return blockMemberWith(prisma, user, username)
}

export function unblockMember(user: AuthenticatedUser, username: string) {
  return unblockMemberWith(prisma, user, username)
}

export function listBlockedMembers(user: AuthenticatedUser) {
  return listBlockedMembersWith(prisma, user)
}

export function reportMember(user: AuthenticatedUser, username: string, reason: string) {
  return reportMemberWith(prisma, user, username, reason)
}

export function listReports(user: AuthenticatedUser) {
  return listReportsWith(prisma, user)
}

export { isAdmin } from '@/server/application/authorization'
export type { SetUsernameResult, UsernameState } from './set-username'
export type { BlockedMember, MemberBinder, NetworkMember, NetworkPage } from './network'
export type { ReportView } from './reports'
