'use client'

import { Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Barra de busca.
 *
 * `type="search"` e `role="searchbox"` implicito fazem o teclado do celular
 * mostrar "buscar" em vez de "enter", que e a diferenca entre uma busca e uma
 * quebra de linha acidental.
 *
 * O botao de limpar so aparece com conteudo, e nao permanentemente esmaecido:
 * um alvo de 44 px que nao faz nada rouba espaco da barra no celular.
 *
 * A busca em si — debounce, ida ao servidor, sugestoes — nao mora aqui. Este
 * componente e controlado, e quem o usa decide quando consultar.
 */

export interface SearchBarProps
  extends Omit<React.ComponentPropsWithoutRef<'input'>, 'value' | 'onChange' | 'type'> {
  label: string
  value: string
  onValueChange: (value: string) => void
  onClear?: () => void
  className?: string
}

export function SearchBar({
  label,
  value,
  onValueChange,
  onClear,
  className,
  placeholder,
  ...props
}: SearchBarProps) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search
        className="pointer-events-none absolute left-3 size-4 text-text-subtle"
        aria-hidden
      />
      <input
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(
          'h-11 w-full rounded-control border border-border bg-surface',
          'pl-9 pr-11 text-base text-text placeholder:text-text-subtle',
          'outline-none transition-colors focus-visible:border-accent-ink',
          // O X nativo do WebKit duplicaria o nosso botao de limpar.
          '[&::-webkit-search-cancel-button]:appearance-none',
        )}
        {...props}
      />
      {value ? (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => {
            onValueChange('')
            onClear?.()
          }}
          className="absolute right-0 inline-flex size-11 items-center justify-center rounded-control text-text-muted hover:text-text"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
