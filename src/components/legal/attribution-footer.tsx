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
/**
 * O texto, palavra por palavra como o dono do produto escreveu em 18/09.
 * Exportado porque Minha conta repete a primeira frase em "Fonte do catálogo".
 */
export const INDEPENDENCE_NOTICE =
  'A ColeXa é uma plataforma independente e não é afiliada, patrocinada ou endossada pela Bandai Namco Entertainment, Bandai ou quaisquer empresas relacionadas. Dados de cartas baseados em informações disponibilizadas publicamente pelo site oficial do One Piece Card Game.'

export const RIGHTS_NOTICE =
  'One Piece © Eiichiro Oda/Shueisha. © Toei Animation. One Piece Card Game © Bandai Namco Entertainment Inc.'

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
      <p>{INDEPENDENCE_NOTICE}</p>
      <p>{RIGHTS_NOTICE}</p>
    </Tag>
  )
}
