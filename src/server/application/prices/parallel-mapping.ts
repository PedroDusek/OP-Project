import { NotFoundError, ValidationError } from '@/server/domain/errors'
import { validateManualLinks, type ManualLink } from '@/server/domain/prices/manual-links'
import { MANTIDO_CONTRA_A_LIGA } from '@/server/domain/prices/parallel-candidates'
import {
  loadManualLinks,
  MANUAL_LINKS_PATH,
  saveManualLinks,
} from '@/server/infrastructure/prices/manual-links-file'
import {
  loadParallelCandidates,
  PARALLEL_CANDIDATES_PATH,
  type ParallelCandidatesFile,
} from '@/server/infrastructure/prices/parallel-candidates-file'

/**
 * O mapeamento manual das paralelas, visto pela tela `/dev/paralelas`.
 *
 * Camada: application. A tela lê os candidatos e grava a resposta da pessoa no
 * arquivo de vínculos manuais (decisão 068). O banco não é tocado aqui: quem
 * aplica o arquivo é a importação de preço, a mesma que leva o resultado a
 * produção.
 *
 * ## Só existe fora de produção
 *
 * Grava um arquivo do repositório, e isso só faz sentido na máquina de quem
 * desenvolve. Em produção a pasta nem é gravável, e o resultado chega lá pelo PR
 * que leva o arquivo. A recusa está aqui, e não só na tela: uma ação de servidor
 * pode ser chamada direto.
 *
 * A recusa é `NotFoundError`, e não de autorização: fora de desenvolvimento a
 * tela não existe, e a ação responde o mesmo que a página.
 *
 * ## Erros tipados
 *
 * Tudo o que a pessoa pode causar sai como `AppError`, porque a ação só mostra a
 * mensagem de erro da taxonomia — um `Error` puro vira "erro interno" com um id,
 * e quem mapeia não saberia que foi o produto repetido.
 */

export function mappingAvailable(): boolean {
  return process.env.NODE_ENV !== 'production'
}

function exigirDesenvolvimento(): void {
  if (!mappingAvailable()) {
    throw new NotFoundError('O mapeamento de paralelas só existe fora de produção.')
  }
}

export interface MappingView {
  /** `null` quando o levantamento ainda não foi gerado. */
  candidates: ParallelCandidatesFile | null
  /** Quantas respostas o arquivo manual já tem, para a tela mostrar o progresso. */
  answered: number
  /**
   * As respostas já gravadas, por `source_id`: o produto, ou `null` para "não
   * tem", e a nota.
   *
   * O levantamento é um retrato de quando foi gerado, e não sabe do que se gravou
   * depois. Sem isto, a tela mostraria em branco uma carta já respondida, e
   * gravar de novo apagaria a resposta anterior sem a pessoa vê-la.
   */
  manual: Record<string, { produto: string | null; nota?: string }>
}

export function readMapping(
  paths: { candidates?: string; manual?: string } = {},
): MappingView {
  exigirDesenvolvimento()
  const manual = loadManualLinks(paths.manual ?? MANUAL_LINKS_PATH)
  return {
    candidates: loadParallelCandidates(paths.candidates ?? PARALLEL_CANDIDATES_PATH),
    answered: manual.length,
    manual: Object.fromEntries(
      manual.map((link) => [link.variante, { produto: link.produto, ...(link.nota ? { nota: link.nota } : {}) }]),
    ),
  }
}

/** A resposta da pessoa para uma arte nossa: o produto, ou `null` para "não tem". */
export interface MappingAnswer {
  sourceId: string
  productId: string | null
}

export interface RecordResult {
  recorded: number
}

/**
 * Grava as respostas de uma carta no arquivo manual.
 *
 * ## Confere contra o levantamento, e não confia no formulário
 *
 * Cada arte tem de ser uma arte **daquela carta** no levantamento, e cada produto
 * um produto da fonte **daquela carta**. Um formulário adulterado — ou só uma tela
 * aberta desde antes de um levantamento novo — não grava vínculo que a importação
 * depois recusaria, e o erro aparece aqui, com o nome do que não fechou.
 *
 * Substitui as respostas anteriores das mesmas artes, e não acrescenta: mudar de
 * ideia sobre uma carta é gravar de novo.
 *
 * ## Manter contra a Liga é resposta
 *
 * A arte em que a página da Liga aponta outro produto e a pessoa escolhe um
 * diferente do sugerido ganha a nota `MANTIDO_CONTRA_A_LIGA`: sem ela, a arte
 * voltaria à tela a cada levantamento (decisão 077).
 */
export function recordCardMapping(
  cardCode: string,
  answers: readonly MappingAnswer[],
  paths: { candidates?: string; manual?: string } = {},
): RecordResult {
  exigirDesenvolvimento()

  if (answers.length === 0) {
    throw new ValidationError(`Nenhuma resposta para ${cardCode}: escolha ao menos uma arte.`)
  }

  const levantamento = loadParallelCandidates(paths.candidates ?? PARALLEL_CANDIDATES_PATH)
  const carta = levantamento?.cartas.find((c) => c.cardCode === cardCode)
  if (!carta) throw new NotFoundError(`A carta ${cardCode} não está no levantamento atual.`)

  const artes = new Map(carta.ours.map((art) => [art.sourceId, art]))
  const produtos = new Set(carta.theirs.map((art) => art.productId))

  for (const answer of answers) {
    if (!artes.has(answer.sourceId)) {
      throw new ValidationError(`A arte ${answer.sourceId} não é de ${cardCode} no levantamento.`)
    }
    if (answer.productId !== null && !produtos.has(answer.productId)) {
      throw new ValidationError(`O produto ${answer.productId} não é de ${cardCode} na fonte.`)
    }
  }

  const manualPath = paths.manual ?? MANUAL_LINKS_PATH
  const anteriores = loadManualLinks(manualPath)
  const respondidas = new Set(answers.map((answer) => answer.sourceId))
  const mantidas = anteriores.filter((link) => !respondidas.has(link.variante))
  const novas: ManualLink[] = answers.map((answer) => {
    const sugestao = artes.get(answer.sourceId)!.sugestao
    if (sugestao !== null && answer.productId !== sugestao) {
      return { variante: answer.sourceId, produto: answer.productId, nota: MANTIDO_CONTRA_A_LIGA }
    }
    // A nota e de quem escreveu o porque; regravar a mesma resposta nao a apaga.
    const antes = anteriores.find((link) => link.variante === answer.sourceId)
    const nota =
      antes && antes.produto === answer.productId && antes.nota !== MANTIDO_CONTRA_A_LIGA ? antes.nota : undefined
    return { variante: answer.sourceId, produto: answer.productId, ...(nota ? { nota } : {}) }
  })

  // Confere antes de gravar: dar o mesmo produto a duas artes — nesta carta, ou
  // uma resposta nova contra uma antiga — e recusado inteiro, e o arquivo nao
  // fica pela metade.
  let todas: ManualLink[]
  try {
    todas = validateManualLinks([...mantidas, ...novas])
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : String(error))
  }

  saveManualLinks(todas, manualPath)
  return { recorded: novas.length }
}
