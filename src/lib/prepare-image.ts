import { MAX_IMAGE_BYTES } from '@/server/domain/storage/image'

/**
 * Prepara uma foto escolhida no aparelho antes de enviar.
 *
 * Roda no navegador, e faz três coisas que o servidor não pode fazer por
 * ninguém — porque a essa altura o arquivo já viajou.
 *
 * **Encolhe.** Uma foto de celular tem 3 a 5 MB e milhares de pixels de lado.
 * Ela é exibida num quadrado de 48 px na lista e desfocada a 25% no cabeçalho:
 * mandar o original é gastar a rede de quem envia e o armazenamento de todo
 * mundo para jogar fora depois.
 *
 * **Converte para JPEG.** O iPhone entrega HEIC em algumas situações, e o
 * servidor recusa pelos bytes — só PNG e JPEG passam. Recusar a foto que a
 * pessoa acabou de tirar, sem ela entender por quê, é o pior desfecho possível.
 * Passar pelo canvas normaliza o formato seja qual for a origem.
 *
 * **Faz caber.** O corpo de uma Server Action tem teto, e o do domínio também.
 * Depois de encolher, uma foto de binder fica na casa das centenas de KB.
 *
 * Nada disso substitui a validação do servidor: isto é conveniência de quem
 * envia, e o servidor continua conferindo os bytes de quem chega.
 */

/** Lado maior da imagem enviada. Acima disso não melhora nada visível. */
const MAX_EDGE = 1600

const QUALITY = 0.85

/**
 * Teto para a decodificacao.
 *
 * Um navegador que nao dispara `onload` nem `onerror` deixaria a promessa
 * pendente para sempre — e o botao de salvar desabilitado junto, sem nada na
 * tela explicando. Passado o tempo, segue o arquivo original.
 */
const DECODE_TIMEOUT_MS = 8000

export async function prepareImage(file: File): Promise<File> {
  const image = await decode(file)
  if (!image) return file

  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) return file
  context.drawImage(image, 0, 0, width, height)

  const blob = await toBlob(canvas)
  // Sem `toBlob` utilizável, o original segue: o servidor ainda decide.
  if (!blob || blob.size > MAX_IMAGE_BYTES) return file

  return new File([blob], renameToJpg(file.name), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

/**
 * Decodifica o arquivo, ou `null` quando o navegador não dá conta.
 *
 * A URL de objeto é revogada só **depois** de a imagem carregar: revogar antes
 * deixa a decodificação sem fonte, e o desenho sai em branco.
 */
function decode(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    let done = false

    const finish = (result: HTMLImageElement | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(result)
    }

    const timer = setTimeout(() => finish(null), DECODE_TIMEOUT_MS)

    image.onload = () => finish(image)
    image.onerror = () => finish(null)
    image.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', QUALITY)
  })
}

function renameToJpg(name: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'foto'
  return `${base}.jpg`
}
