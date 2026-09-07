import { cn } from '@/lib/cn'
import { Button } from './button'

/**
 * Os estados obrigatorios da secao 17: Loading, Empty e Error.
 *
 * Estao juntos porque sao a mesma decisao vista de tres angulos — o que a tela
 * mostra quando nao tem o conteudo final — e separa-los levaria a tres
 * aparencias diferentes para o mesmo momento.
 */

/**
 * Esqueleto de carregamento.
 *
 * `aria-hidden` de proposito: o leitor de tela nao deve anunciar retangulos
 * cinzas. Quem avisa que algo esta carregando e o `aria-busy` do container,
 * ou o texto do proprio `Loading`.
 */
export function Skeleton({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-control bg-skeleton', className)}
      {...props}
    />
  )
}

/** Grade de esqueletos com a proporcao de uma carta (secao 18). */
export function CardGridSkeleton({ count = 9, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn('grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6', className)}
      aria-hidden
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <Skeleton className="aspect-[5/7] w-full rounded-card" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export interface StateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  /** Secao 17: o vazio explica o vazio **e** a proxima acao. */
  action?: { label: string; onClick?: () => void; href?: string }
  className?: string
}

export function EmptyState({ title, description, icon, action, className }: StateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="text-text-subtle">{icon}</div> : null}
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-text">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {action ? (
        action.href ? (
          <Button asChild variant="secondary" className="mt-1">
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : (
          <Button variant="secondary" className="mt-1" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  )
}

/**
 * Erro com nova tentativa quando ela for possivel (secao 17).
 *
 * `role="alert"` para o leitor de tela anunciar sem esperar o proximo foco: se
 * a lista falhou, quem esta esperando precisa saber agora.
 */
export function ErrorState({
  title = 'Não foi possível carregar',
  description,
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-text">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="secondary" className="mt-1" onClick={onRetry}>
          Tentar de novo
        </Button>
      ) : null}
    </div>
  )
}
