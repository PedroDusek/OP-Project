/**
 * Mandar uma imagem para fora do produto: a folha do sistema, ou o download.
 *
 * Saiu de `want-sheet-print.tsx` em 23/11, quando a decklist ganhou a própria
 * folha. É conhecimento caro — o que está aqui foi aprendido em aparelho de
 * verdade, e uma segunda cópia o perderia pela metade na primeira divergência.
 *
 * ## O motivo mais comum de não dar para compartilhar não é o navegador, é o
 * endereço
 *
 * `navigator.share` só existe em **contexto seguro**. Aberto pelo IP da rede
 * local em `http://`, como se testa no celular durante o desenvolvimento, a API
 * simplesmente não está lá — e o mesmo aparelho, no mesmo navegador,
 * compartilha sem problema em `https://`. Ver a armadilha 48 no handoff.
 *
 * ## Por que dois pacotes, e não um
 *
 * O iOS recusa `files` junto de `text` em várias versões: `canShare` devolve
 * `false` para o pacote inteiro, e o botão sumiria mesmo num aparelho que
 * compartilha imagem sem dificuldade nenhuma.
 *
 * Então pergunta-se pelo pacote completo e, se ele não passar, pelos arquivos
 * sozinhos. A legenda é enfeite; as imagens são o assunto, e perder a legenda é
 * muito melhor que perder o botão.
 *
 * O que for aprovado é o que vai ser enviado — conferir um pacote e mandar
 * outro é a forma mais direta de o iOS recusar sem dizer por quê.
 *
 * ## As checagens, e por que são separadas
 *
 * `share` sozinho existe em navegadores que só mandam texto e link; `canShare`
 * sem argumento responde sobre a API, não sobre estes arquivos. Só
 * `canShare({ files })` responde a pergunta que importa, e ele precisa de
 * `File` — com `Blob` devolve `false` sem dizer por quê.
 */
export type CargaDeCompartilhamento =
  | { ok: true; dados: ShareData }
  | { ok: false; motivo: 'inseguro' | 'sem-suporte' }

export function cargaParaCompartilhar(
  arquivos: readonly File[],
  titulo: string,
  legenda: string,
): CargaDeCompartilhamento {
  if (arquivos.length === 0) return { ok: false, motivo: 'sem-suporte' }
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { ok: false, motivo: 'sem-suporte' }
  }

  if (window.isSecureContext === false) return { ok: false, motivo: 'inseguro' }

  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return { ok: false, motivo: 'sem-suporte' }
  }

  const files = [...arquivos]
  const candidatos: ShareData[] = [{ files, title: titulo, text: legenda }, { files }]

  for (const dados of candidatos) {
    try {
      if (navigator.canShare(dados)) return { ok: true, dados }
    } catch {
      // Pacote recusado por este navegador. Tenta o proximo.
    }
  }

  return { ok: false, motivo: 'sem-suporte' }
}

/**
 * Entrega um arquivo. **Um**, e sempre a partir de um toque.
 *
 * O `<a>` entra no documento antes do clique e sai depois: o Safari ignora o
 * clique num elemento que nunca esteve na árvore.
 *
 * O endereço não é revogado aqui. `click()` só **inicia** o download; revogar na
 * linha seguinte derruba o endereço antes de o navegador ler os bytes, e o
 * arquivo sai vazio ou nem sai. O minuto é folga larga de propósito.
 */
export function baixarArquivo(arquivo: File): void {
  const url = URL.createObjectURL(arquivo)
  const link = document.createElement('a')

  link.href = url
  link.download = arquivo.name
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Um nome de arquivo a partir do que a pessoa digitou.
 *
 * Sem acento, sem espaço e sem o que um sistema de arquivos recusa: o nome da
 * decklist é texto livre, e ele vira o nome do arquivo que chega ao grupo.
 * Nome que esvazia cai no reserva — um arquivo chamado `.jpg` não abre.
 */
export function nomeDeArquivo(base: string, reserva: string): string {
  const limpo = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60)

  return `${limpo === '' ? reserva : limpo}-colexa.jpg`
}
