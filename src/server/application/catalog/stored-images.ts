import { readStoredImage } from '@/server/infrastructure/catalog/stored-images-dir'

/**
 * A arte guardada por nós (decisão 113).
 *
 * Camada: application. Existe para a rota não falar com `infrastructure`, que é
 * a fronteira que o lint impõe.
 */
export function readCardImage(file: string): Buffer | null {
  return readStoredImage(file)
}
