import { readCardImage } from '@/server/application/catalog/stored-images'

/**
 * Serve a arte da carta do disco da máquina (decisão 113).
 *
 * A Bandai passou a estrangular o endereço da Fly, e o tempo limite que o Next
 * usa para buscar na origem é fixo no código dele — 7 s, sem configuração. Toda
 * arte fora do cache virava imagem quebrada. Agora a arte já está aqui,
 * convertida, e a resposta é leitura de disco.
 *
 * ## Sem passar pelo otimizador
 *
 * A imagem é gravada já em `webp` e no tamanho que a maior tela pede, então não
 * há o que otimizar a cada pedido — e o `sharp` deixa de disputar o núcleo da
 * máquina, que é `shared-cpu-1x`.
 *
 * ## `immutable`
 *
 * A arte de uma carta não muda: a Bandai publica um arquivo por `source_id` e
 * ele é o que é. O navegador pode guardar para sempre. Se um dia uma arte for
 * corrigida na origem, o `source_id` novo traz nome novo — e nome novo não tem
 * cache velho.
 */
export async function GET(_request: Request, { params }: RouteContext<'/imagens/cartas/[arquivo]'>) {
  const { arquivo } = await params

  const bytes = readCardImage(arquivo)
  if (bytes === null) return new Response('Arte não encontrada', { status: 404 })

  return new Response(new Uint8Array(bytes), {
    headers: {
      'content-type': 'image/webp',
      'cache-control': 'public, max-age=31536000, immutable',
      'content-length': String(bytes.byteLength),
    },
  })
}
