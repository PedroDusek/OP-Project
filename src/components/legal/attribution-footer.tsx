import { cn } from '@/lib/cn'

/**
 * A atribuição, no rodapé de toda tela.
 *
 * É uma das mitigações obrigatórias da decisão 020, e não cortesia: ela é parte
 * do que sustenta o uso do catálogo da Bandai. Até 18/09 aparecia só na página
 * inicial, no Trade Binder público e em Minha conta, e sem o crédito de direitos
 * que a 020 pede. O dono do produto pediu que ela esteja em todas as telas.
 *
 * Um componente só, para o texto não divergir entre as molduras que o usam: a do
 * app, a das telas de conta, a página inicial, o Trade Binder público, as páginas
 * legais e as de erro.
 *
 * Fora da impressão: a folha da want list leva o próprio crédito.
 */
export function AttributionFooter({
  className,
  as: Tag = 'footer',
}: {
  className?: string
  /** `div` quando já está dentro de um `<footer>`, que não pode conter outro. */
  as?: 'footer' | 'div'
}) {
  return (
    <Tag className={cn('flex flex-col gap-1 text-xs text-text-subtle print:hidden', className)}>
      <p>
        Dados de cartas do site oficial do One Piece Card Game, da Bandai. O ColeXa não tem vínculo,
        parceria ou endosso da Bandai.
      </p>
      <p>One Piece © Eiichiro Oda/Shueisha, Toei Animation. One Piece Card Game © Bandai Namco Entertainment.</p>
    </Tag>
  )
}
