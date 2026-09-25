import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { sourceIdFromFile, storedImageFile } from '@/server/domain/catalog/stored-image'

/**
 * Onde as artes guardadas moram (decisão 113).
 *
 * Camada: infrastructure.
 *
 * ## Por que dentro de `.next/cache`
 *
 * É o volume que a Fly monta (`fly.toml`, `colexa_cache`), e ele sobrevive à
 * publicação — a imagem do contêiner é trocada, o volume não. Usar uma subpasta
 * dele evita um segundo ponto de montagem para guardar a mesma natureza de
 * coisa.
 *
 * `cartas` fica **ao lado** de `images`, que é do otimizador do Next: são donos
 * diferentes, e misturar faria a limpeza de um alcançar o outro.
 *
 * ## O que não pode acontecer
 *
 * **A conversão nunca roda na máquina da Fly.** Ela baixa da Bandai, e de lá a
 * Bandai responde a 8 KB/s desde 25/09 — reconstruir as 4.431 artes levaria uns
 * 53 h. Daqui leva umas 2 h 30. Quem escrever um comando que gere imagem no
 * servidor está reintroduzindo o defeito que esta decisão existe para remover.
 */

const PADRAO = resolve(process.cwd(), '.next', 'cache', 'cartas')

/** A pasta, sobrescrita por `CARD_IMAGES_DIR` quando existir. */
export function storedImagesDir(): string {
  const configurada = process.env.CARD_IMAGES_DIR?.trim()
  return configurada ? resolve(configurada) : PADRAO
}

/**
 * Lê uma arte guardada. `null` quando não existe.
 *
 * O nome é conferido pelo domínio **antes** de virar caminho: sem isso, um
 * `../` no pedido leria arquivo fora da pasta.
 */
export function readStoredImage(file: string): Buffer | null {
  if (sourceIdFromFile(file) === null) return null
  try {
    return readFileSync(join(storedImagesDir(), file))
  } catch {
    return null
  }
}

/** Grava uma arte convertida. Usado só pelo preparo, que roda fora da Fly. */
export function writeStoredImage(sourceId: string, bytes: Buffer): string {
  const file = storedImageFile(sourceId)
  if (file === null) throw new Error(`identificador de arte invalido: ${sourceId}`)

  const dir = storedImagesDir()
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), bytes)
  return file
}
