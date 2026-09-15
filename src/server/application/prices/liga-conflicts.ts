import { NotFoundError, ValidationError } from '@/server/domain/errors'
import { validateManualLinks, type ManualLink } from '@/server/domain/prices/manual-links'
import {
  LIGA_CONFLICTS_PATH,
  loadLigaConflicts,
  type LigaConflictsFile,
} from '@/server/infrastructure/prices/liga-conflicts-file'
import {
  loadManualLinks,
  MANUAL_LINKS_PATH,
  saveManualLinks,
} from '@/server/infrastructure/prices/manual-links-file'

/**
 * Os conflitos entre a Liga e os vínculos, vistos pela tela `/dev/liga/conflitos`
 * (decisão 074).
 *
 * Camada: application. Lê o levantamento e grava a resposta da pessoa no arquivo
 * de vínculos manuais (decisão 068). O banco não é tocado: quem aplica é a
 * importação de preço, e o vínculo manual vence qualquer regra.
 *
 * Só existe fora de produção, pelo mesmo motivo das outras telas de mapeamento:
 * grava um arquivo do repositório, e a ação pode ser chamada sem a página.
 */

export type { LigaConflict, LigaConflictProduct } from '@/server/infrastructure/prices/liga-conflicts-file'

export function ligaConflictsAvailable(): boolean {
  return process.env.NODE_ENV !== 'production'
}

function exigirDesenvolvimento(): void {
  if (!ligaConflictsAvailable()) {
    throw new NotFoundError('A revisão dos conflitos só existe fora de produção.')
  }
}

export interface LigaConflictsView {
  /** `null` quando o levantamento ainda não foi gerado. */
  levantamento: LigaConflictsFile | null
  /** As respostas já gravadas no arquivo manual, por `source_id`. */
  respostas: Record<string, string | null>
}

type Paths = { conflicts?: string; manual?: string }

export function readLigaConflicts(paths: Paths = {}): LigaConflictsView {
  exigirDesenvolvimento()
  const manual = loadManualLinks(paths.manual ?? MANUAL_LINKS_PATH)
  return {
    levantamento: loadLigaConflicts(paths.conflicts ?? LIGA_CONFLICTS_PATH),
    respostas: Object.fromEntries(manual.map((link) => [link.variante, link.produto])),
  }
}

/**
 * Grava a resposta de um conflito: o produto certo da carta, ou `null` para "nenhum
 * destes" — a arte fica sem preço até alguém achar o produto.
 *
 * Confere contra o levantamento, e não confia no formulário: a arte tem de ser um
 * conflito listado, e o produto, um da **mesma carta**. Substitui a resposta
 * anterior da mesma arte, e o arquivo é recusado inteiro se um produto ficar com
 * duas artes.
 */
export function recordConflictAnswer(sourceId: string, productId: string | null, paths: Paths = {}): ManualLink {
  exigirDesenvolvimento()

  const levantamento = loadLigaConflicts(paths.conflicts ?? LIGA_CONFLICTS_PATH)
  const conflito = levantamento?.conflitos.find((c) => c.sourceId === sourceId)
  if (!conflito) throw new NotFoundError(`A arte ${sourceId} não está no levantamento de conflitos.`)
  if (productId !== null && !conflito.produtos.some((p) => p.productId === productId)) {
    throw new ValidationError(`O produto ${productId} não é de ${conflito.cardCode} no TCGplayer.`)
  }

  const manualPath = paths.manual ?? MANUAL_LINKS_PATH
  const anteriores = loadManualLinks(manualPath)
  const antes = anteriores.find((link) => link.variante === sourceId)
  const nota = antes && antes.produto === productId ? antes.nota : undefined
  const nova: ManualLink = { variante: sourceId, produto: productId, ...(nota ? { nota } : {}) }

  let todas: ManualLink[]
  try {
    todas = validateManualLinks([...anteriores.filter((link) => link.variante !== sourceId), nova])
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : String(error))
  }
  saveManualLinks(todas, manualPath)
  return nova
}
