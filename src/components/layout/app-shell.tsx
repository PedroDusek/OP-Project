import { cn } from '@/lib/cn'
import { BottomNav } from './bottom-nav'
import { SideNav } from './side-nav'
import { TopBar, type Viewer } from './top-bar'

/**
 * O esqueleto das areas autenticadas.
 *
 * Um layout so para os tres tamanhos (`architecture.md` 4.1), com a navegacao
 * mudando de lugar e o conteudo ganhando espaco:
 *
 *   base   celular, coluna unica, navegacao inferior
 *   md     tablet, coluna lateral so com icones
 *   lg     desktop, coluna lateral com rotulos
 *
 * Nao e um layout de desktop reduzido: o que existe no celular e o ponto de
 * partida, e as duas navegacoes sao a **mesma** lista de destinos, nunca duas
 * arvores diferentes.
 *
 * O espaco reservado embaixo no celular precisa cobrir a barra inferior fixa,
 * e ela **nao tem altura fixa**: sao 56 px mais `env(safe-area-inset-bottom)`,
 * que num aparelho com barra de gestos passa de 30 px. Reservar 80 px fixos
 * dava conta no navegador de mesa, onde a area segura e zero, e deixava o
 * ultimo elemento da pagina debaixo da barra no celular de verdade — foi assim
 * que o botao de carregar mais ficou dificil de acertar.
 *
 * Por isso a reserva soma a mesma area segura que a barra usa, mais folga.
 */

export interface AppShellProps {
  viewer?: Viewer
  hasUnread?: boolean
  children: React.ReactNode
  className?: string
}

export function AppShell({ viewer, hasUnread, children, className }: AppShellProps) {
  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className={cn(
          'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50',
          'focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:shadow-raised',
        )}
      >
        Pular para o conteúdo
      </a>

      <SideNav />

      {/*
        Na impressao o conteudo ocupa a folha inteira: sem a reserva da barra
        lateral a esquerda, sem a reserva da barra inferior embaixo, e sem o
        limite de largura, que na folha vira margem branca de sobra.
      */}
      <div className="md:pl-16 lg:pl-56 print:pl-0">
        <TopBar viewer={viewer} hasUnread={hasUnread} />
        <main
          id="conteudo"
          className={cn(
            'mx-auto w-full max-w-6xl px-4 pt-4',
            'pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-8',
            'print:max-w-none print:px-0 print:pt-0 print:pb-0',
            className,
          )}
        >
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}

/**
 * Cabecalho de pagina: titulo grande e uma linha de apoio.
 *
 * `h1` porque e o titulo da pagina. O shell nao tem um: o logotipo da barra
 * superior e navegacao, nao cabecalho, e uma pagina sem `h1` deixa quem navega
 * por titulos sem ponto de entrada.
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start gap-3 pb-4', className)}>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight text-text">{title}</h1>
        {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
