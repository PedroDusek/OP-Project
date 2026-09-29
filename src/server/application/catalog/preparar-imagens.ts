import type { PrismaClient } from '@prisma/client'
import sharp from 'sharp'
import { storedImageFile } from '@/server/domain/catalog/stored-image'
import {
  readStoredImage,
  storedImagesDir,
  writeStoredImage,
} from '@/server/infrastructure/catalog/stored-images-dir'

/**
 * Baixa a arte de cada carta e a guarda convertida (decisão 113).
 *
 * Camada: application.
 *
 * ## Onde isto pode rodar
 *
 * **Fora da Fly, sempre.** Desde 25/09 a Bandai responde ao endereço da Fly a
 * cerca de 8 KB/s — medido nos dois lados, com os mesmos arquivos no mesmo
 * instante: 2,1 s daqui contra 27 a 30 s de lá. Rodar isto no servidor devolve
 * o problema que ele existe para remover.
 *
 * ## O tamanho
 *
 * `webp`, 700 px de largura, qualidade 80: medido em 12 artes, 307 KB de
 * original viram 108 KB — as 4.431 cabem em 469 MB, num volume de 7,8 GB.
 *
 * 700 px é o que a maior tela pede. Guardar o original seria 1,30 GB para
 * entregar o mesmo pixel na tela.
 *
 * ## Não refaz o que já está pronto
 *
 * A conversão é cara e a lista é longa. Uma arte já gravada é pulada, então
 * rodar de novo depois de uma coleção nova custa só as artes novas — e uma
 * interrupção no meio não perde o que já foi feito.
 */

export const LARGURA = 700
export const QUALIDADE = 80

export interface PrepararImagensOptions {
  /** Só as primeiras N, para conferir antes de rodar tudo. */
  limite?: number
  /** Refaz mesmo o que já está gravado. */
  refazer?: boolean
  logger?: Pick<Console, 'info' | 'warn'>
}

export interface PrepararImagensResult {
  total: number
  convertidas: number
  jaExistiam: number
  falharam: number
  bytes: number
  pasta: string
  falhas: { sourceId: string; motivo: string }[]
}

export async function prepararImagens(
  prisma: PrismaClient,
  options: PrepararImagensOptions = {},
): Promise<PrepararImagensResult> {
  const logger = options.logger ?? console

  const artes = await prisma.cardVariant.findMany({
    where: { imageUrl: { not: null }, sourceId: { not: null } },
    select: { sourceId: true, imageUrl: true },
    orderBy: { id: 'asc' },
    ...(options.limite ? { take: options.limite } : {}),
  })

  const result: PrepararImagensResult = {
    total: artes.length,
    convertidas: 0,
    jaExistiam: 0,
    falharam: 0,
    bytes: 0,
    pasta: storedImagesDir(),
    falhas: [],
  }

  for (const [indice, arte] of artes.entries()) {
    const sourceId = arte.sourceId!
    const nome = storedImageFile(sourceId)
    if (nome === null) {
      result.falharam += 1
      result.falhas.push({ sourceId, motivo: 'identificador nao serve como nome de arquivo' })
      continue
    }

    const pronta = options.refazer ? null : readStoredImage(nome)
    if (pronta !== null) {
      result.jaExistiam += 1
      result.bytes += pronta.byteLength
      continue
    }

    try {
      const resposta = await fetch(arte.imageUrl!)
      if (!resposta.ok) throw new Error(`origem respondeu ${resposta.status}`)

      const original = Buffer.from(await resposta.arrayBuffer())
      const convertida = await sharp(original)
        .resize(LARGURA, undefined, { withoutEnlargement: true })
        .webp({ quality: QUALIDADE })
        .toBuffer()

      writeStoredImage(sourceId, convertida)
      result.convertidas += 1
      result.bytes += convertida.byteLength
    } catch (error) {
      result.falharam += 1
      result.falhas.push({
        sourceId,
        motivo: error instanceof Error ? error.message : String(error),
      })
    }

    if ((indice + 1) % 100 === 0) {
      logger.info(`[imagens] ${indice + 1} de ${artes.length}...`)
    }
  }

  return result
}
