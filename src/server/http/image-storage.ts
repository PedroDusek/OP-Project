/**
 * Contrato do armazenamento de imagens enviadas pelo usuário.
 *
 * Camada: http. Sem I/O: apenas o formato das operações.
 *
 * Existe pelo mesmo motivo dos outros dois provedores (decisão 025): o caso de
 * uso não sabe que existe Supabase Storage. Trocar de provedor mexe numa
 * implementação, e os testes gravam num provedor de memória, sem rede.
 *
 * ## O que este contrato deliberadamente não faz
 *
 * Não valida a imagem — isso é `domain/storage/image.ts`, e roda antes, para que
 * nenhum byte de um arquivo recusado chegue à rede.
 *
 * Não decide o caminho do arquivo. Quem chama passa um `scope`, e a
 * implementação monta o caminho dentro do escopo. Deixar o caminho completo nas
 * mãos de quem chama seria deixar uma tela escolher gravar por cima da pasta de
 * outra pessoa.
 */

export interface StoredImage {
  /** URL pública, do jeito que vai para a coluna e para o `<img>`. */
  url: string
}

export interface UploadImageInput {
  /**
   * Pasta lógica do dono. Na prática o id do usuário: os arquivos de cada um
   * ficam sob um prefixo próprio, e é isso que a política de acesso usa.
   */
  scope: string
  bytes: Uint8Array
  contentType: string
  extension: string
}

export interface ImageStorage {
  readonly name: string
  /** `null` quando o provedor não está configurado neste ambiente. */
  readonly available: boolean
  upload(input: UploadImageInput): Promise<StoredImage>
  /**
   * Apaga uma imagem enviada antes. Recebe a URL guardada, e ignora em silêncio
   * o que não for dela: a coluna pode conter endereço de outra origem, e apagar
   * uma imagem antiga nunca deve derrubar a edição que a substituiu.
   */
  remove(url: string): Promise<void>
}
