/**
 * O rascunho de uma leva, guardado no navegador de quem escolhe.
 *
 * Marcar oitenta cartas leva um tempo de gente. Até 20/09 essa escolha vivia só
 * na memória da aba: um erro na hora de confirmar mantinha tudo, mas recarregar
 * a página apagava — e foi o que aconteceu com um testador depois que a leva de
 * 131 cartas falhou (armadilha 74).
 *
 * ## Por que no navegador, e não no servidor
 *
 * Pedido do dono do produto: a forma de não perder precisa depender de quem
 * escolhe, e não de guardarmos escolha de todo mundo. Rascunho no banco seria
 * escrita a cada toque no contador, de cada pessoa, para algo que quase sempre
 * vira uma leva confirmada em minutos.
 *
 * O custo disso é honesto: o rascunho fica **naquele** aparelho e naquele
 * navegador. Trocar de celular não traz a escolha junto, e é por isso que a
 * tela pergunta em vez de restaurar calada.
 *
 * ## Por que tudo falha em silêncio
 *
 * `localStorage` lança em janela anônima com armazenamento bloqueado, e enche
 * em aparelho com pouco espaço. Nenhum desses casos pode derrubar a tela de
 * escolher cartas: sem rascunho, o produto funciona como funcionava antes.
 */

/** Cartas escolhidas: id da variante para quantas cópias. */
export type Rascunho = Record<string, number>

const PREFIXO = 'colexa:leva:'

/** Uma chave por destino: a leva de um binder não é a da want list. */
export function chaveDaLeva(destino: string): string {
  return `${PREFIXO}${destino}`
}

/*
 * O último texto lido e o objeto que saiu dele.
 *
 * `useSyncExternalStore` compara a leitura por identidade: devolver um objeto
 * novo a cada renderização faria o React renderizar de novo para sempre. Como o
 * texto no armazenamento só muda quando alguém grava, guardá-lo ao lado do
 * resultado é o bastante para a identidade ser estável.
 */
const memoria = new Map<string, { bruto: string | null; valor: Rascunho | null }>()

/** A leitura estável, para a tela. */
export function lerRascunho(chave: string): Rascunho | null {
  let bruto: string | null = null
  try {
    bruto = localStorage.getItem(chave)
  } catch {
    return null
  }

  const guardado = memoria.get(chave)
  if (guardado && guardado.bruto === bruto) return guardado.valor

  const valor = interpretar(bruto)
  memoria.set(chave, { bruto, valor })
  return valor
}

function interpretar(bruto: string | null): Rascunho | null {
  try {
    if (!bruto) return null

    const lido: unknown = JSON.parse(bruto)
    if (typeof lido !== 'object' || lido === null) return null

    // Confere item a item: o que está no navegador pode ter sido editado à mão,
    // e uma quantidade inválida viraria erro na hora de confirmar.
    const limpo: Rascunho = {}
    for (const [variantId, copias] of Object.entries(lido as Record<string, unknown>)) {
      if (!/^\d+$/.test(variantId)) continue
      if (typeof copias !== 'number' || !Number.isInteger(copias) || copias <= 0) continue
      limpo[variantId] = copias
    }

    return Object.keys(limpo).length > 0 ? limpo : null
  } catch {
    return null
  }
}

export function gravarRascunho(chave: string, rascunho: Rascunho): void {
  try {
    if (Object.keys(rascunho).length === 0) localStorage.removeItem(chave)
    else localStorage.setItem(chave, JSON.stringify(rascunho))
  } catch {
    // Sem espaço ou sem permissão: segue sem rascunho.
  }
  avisar()
}

export function limparRascunho(chave: string): void {
  try {
    localStorage.removeItem(chave)
  } catch {
    // Ver acima.
  }
  avisar()
}

/*
 * A tela lê o rascunho por `useSyncExternalStore`, e não num efeito: o servidor
 * não tem `localStorage`, e ler durante a renderização faria o HTML do servidor
 * divergir do que o navegador desenha. `useSyncExternalStore` é o que o React
 * oferece para exatamente isto — valor do servidor nulo, valor do cliente lido
 * depois da hidratação.
 */
const ouvintes = new Set<() => void>()

function avisar(): void {
  for (const ouvinte of ouvintes) ouvinte()
}

export function observarRascunho(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  // Outra aba mexendo no mesmo rascunho também conta.
  window.addEventListener('storage', ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
    window.removeEventListener('storage', ouvinte)
  }
}
