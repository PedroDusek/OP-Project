'use client'

import { useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { CardArt } from '@/components/catalog/card-art'
import { Logotype, Symbol } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { CARDS_PER_SHEET, renderWantSheets } from '@/lib/want-sheet-image'
import type { WantView } from '@/server/application/wants'

/**
 * A want list em folha, para virar PDF.
 *
 * ## Duas saídas, e elas servem a coisas diferentes
 *
 * **JPEG** é o caminho normal: baixa direto, e imagem se manda em grupo sem
 * ninguém precisar abrir nada. Sai uma imagem por folha de doze, o mesmo corte
 * da impressão — uma lista longa numa imagem só vira uma tira que o WhatsApp
 * recomprime até o número da carta borrar. Ele é desenhado aqui no aparelho, com as
 * imagens da fonte de preço — as únicas que o navegador deixa exportar
 * (decisão 058).
 *
 * **Imprimir** continua, e não é redundância: a folha impressa usa as imagens
 * do catálogo, que existem para **todas** as cartas. No JPEG, quem ainda não
 * tem vínculo com a fonte de preço sai com o código no lugar da arte.
 *
 * ## Por que impressão do navegador, e não um PDF gerado por nós
 *
 * Porque a decisão 026 não deixa, e ela é mitigação **jurídica**: as imagens de
 * carta são referenciadas na origem, **nunca copiadas nem rearmazenadas**.
 *
 * Gerar o arquivo por JavaScript exigiria desenhar cada imagem num `canvas`, e
 * o host da Bandai não manda `Access-Control-Allow-Origin` — conferido. O
 * `canvas` ficaria contaminado e o navegador recusaria exportar. O contorno
 * seria servir as imagens pelo nosso domínio, que é exatamente o que a decisão
 * proíbe.
 *
 * Na impressão do navegador nada disso acontece: as imagens são carregadas pelo
 * aparelho de quem usa, direto da origem, como em qualquer página. O PDF sai
 * pelo "Salvar como PDF" do diálogo, fica no aparelho, e não passa pelo nosso
 * servidor nem pelo nosso banco.
 *
 * ## O que a folha carrega da marca
 *
 * Logotipo no topo e o X apagado ao fundo. É divulgação, e é o tipo de
 * ornamento que a seção 19 da especificação permite — forma própria da marca,
 * nunca arte de franquia.
 *
 * O X vai com opacidade um pouco maior que na tela: impresso a jato de tinta,
 * 4% some no papel.
 */
export function WantSheetPrint({ wants }: { wants: WantView[] }) {
  const [gerando, setGerando] = useState(false)
  const { toast } = useToast()

  const faltando = wants.filter((want) => want.status !== 'satisfied')
  const copias = faltando.reduce((total, want) => total + want.remaining, 0)
  const semArte = faltando.filter((want) => want.sheetImageUrl === null).length
  const folhas = Math.max(1, Math.ceil(faltando.length / CARDS_PER_SHEET))

  /**
   * Desenha e entrega o arquivo.
   *
   * O `<a download>` é criado e descartado na hora: um link permanente na tela
   * precisaria de um endereço válido antes de alguém pedir a imagem, e gerar a
   * folha inteira só para o caso de talvez clicarem é trabalho jogado fora.
   */
  const baixar = async () => {
    setGerando(true)
    try {
      const imagens = await renderWantSheets(
        faltando.map((want) => ({
          cardCode: want.cardCode,
          cardName: want.cardName,
          sheetImageUrl: want.sheetImageUrl,
          remaining: want.remaining,
        })),
      )

      for (const [indice, blob] of imagens.entries()) {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download =
          imagens.length === 1
            ? 'want-list-colexa.jpg'
            : `want-list-colexa-${indice + 1}-de-${imagens.length}.jpg`
        link.click()

        /*
         * O endereço não é revogado aqui.
         *
         * `click()` só **inicia** o download; revogar na linha seguinte
         * derruba o endereço antes de o navegador ler os bytes, e o arquivo sai
         * vazio ou nem sai. O minuto é folga larga de propósito: a alternativa
         * é vazar um punhado de blobs, que somem quando a aba fecha.
         */
        setTimeout(() => URL.revokeObjectURL(url), 60_000)

        // Uma pausa entre os arquivos. Vários cliques no mesmo instante fazem
        // o navegador tratar o segundo em diante como download não pedido.
        if (indice < imagens.length - 1) await new Promise((r) => setTimeout(r, 300))
      }
    } catch (error) {
      toast({
        title: 'Não foi possível gerar a imagem',
        description: error instanceof Error ? error.message : 'Tente imprimir a folha.',
        tone: 'error',
      })
    } finally {
      setGerando(false)
    }
  }

  if (faltando.length === 0) {
    return (
      <EmptyState
        title="Nada faltando"
        description="Quando houver carta na sua want list que você ainda não tem, ela aparece aqui pronta para imprimir."
        action={{ label: 'Adicionar cartas', href: '/colecao/quero/adicionar' }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/*
        Some na impressão: um botão "imprimir" impresso na folha é ruído, e é o
        primeiro sinal de que a folha foi feita para a tela e não para o papel.
      */}
      <div className="flex flex-col gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void baixar()} loading={gerando}>
            <Download className="size-4" aria-hidden />
            Baixar imagem
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            Imprimir
          </Button>
        </div>
        <p className="text-sm text-text-muted">
          {folhas > 1
            ? `Saem ${folhas} imagens, de até ${CARDS_PER_SHEET} cartas cada — o navegador pode pedir permissão para baixar várias. `
            : 'A imagem baixa direto. '}
          {semArte > 0
            ? `${semArte} ${semArte === 1 ? 'carta sai' : 'cartas saem'} com o código no lugar da arte; imprimindo, todas saem com a arte.`
            : 'Imprimindo, escolha “Salvar como PDF” no diálogo.'}
        </p>
      </div>

      <article className="relative overflow-hidden rounded-card border border-border bg-white p-6 text-black print:rounded-none print:border-0 print:p-0">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <Symbol
            label={null}
            className="absolute -top-[10%] -right-[22%] h-[120%] w-auto -rotate-12 opacity-[0.06]"
          />
        </div>

        <header className="relative mb-5 flex items-end justify-between gap-4 border-b border-black/10 pb-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight">Procuro estas cartas</h2>
            <p className="mt-1 text-sm text-black/60 tabular-nums">
              {faltando.length} {faltando.length === 1 ? 'carta' : 'cartas'} ·{' '}
              {copias} {copias === 1 ? 'cópia' : 'cópias'}
            </p>
          </div>
          <Logotype label="ColeXa" className="h-6 w-auto shrink-0 text-black" />
        </header>

        <ul className="relative grid grid-cols-3 gap-4 sm:grid-cols-4 print:grid-cols-4">
          {faltando.map((want) => (
            <li key={want.variantId} className="flex break-inside-avoid flex-col gap-1">
              <span className="relative block">
                <CardArt
                  src={want.imageUrl}
                  alt={`${want.cardCode} — ${want.cardName}`}
                  fallback={want.cardCode}
                  sizes="(max-width: 639px) 33vw, 25vw"
                />
                {/*
                  A quantidade é o dado que a folha existe para carregar: quem
                  olha precisa saber quantas, não só quais.
                */}
                <span className="absolute right-1 bottom-1 rounded-md bg-black px-1.5 py-0.5 text-xs font-bold text-white tabular-nums">
                  {want.remaining}x
                </span>
              </span>
              <span className="truncate text-[11px] font-semibold tabular-nums">
                {want.cardCode}
              </span>
              <span className="truncate text-[11px] text-black/60">{want.cardName}</span>
            </li>
          ))}
        </ul>

        <footer className="relative mt-6 border-t border-black/10 pt-3 text-[10px] text-black/50">
          Lista gerada no ColeXa · colexa.com.br
        </footer>
      </article>
    </div>
  )
}
