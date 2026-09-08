/**
 * Tema claro e escuro.
 *
 * Sao tres estados, nao dois. "Sistema" e um estado de verdade: significa
 * acompanhar o sistema operacional para sempre, e nao "claro por enquanto".
 * Quem alterna so entre claro e escuro perde isso — a pessoa nunca mais
 * consegue voltar a seguir o sistema depois do primeiro toque.
 *
 * A aplicacao acontece em `color-scheme`, e nao numa classe: os tokens de
 * `globals.css` usam `light-dark()`, que le exatamente essa propriedade. Ver o
 * comentario de topo do arquivo.
 *
 * A escolha vive no `localStorage` porque e preferencia de dispositivo, nao
 * dado de conta: a mesma pessoa pode querer escuro no celular e claro no
 * desktop. Guardar no banco exigiria uma coluna nova, que nao esta aprovada, e
 * daria a resposta errada para esse caso.
 */

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_STORAGE_KEY = 'colexa:theme'

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

/** Escreve a escolha no documento. `system` significa remover o atributo. */
export function applyTheme(theme: Theme, root: HTMLElement): void {
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : 'system'
  } catch {
    // Navegador em modo privado, ou armazenamento bloqueado. Seguir o sistema
    // e a resposta certa: e o padrao, e nao ha nada a restaurar.
    return 'system'
  }
}

export function storeTheme(theme: Theme): void {
  try {
    if (theme === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Nao poder lembrar nao pode impedir de aplicar agora.
  }
}

/**
 * Roda antes da primeira pintura, no `<head>`.
 *
 * Sem isto a pagina aparece no tema do sistema e so troca para o tema escolhido
 * quando o React hidrata — o flash branco de sempre. Nao da para resolver com
 * `useEffect`, que por definicao roda depois da pintura; tem que ser sincrono,
 * antes do `<body>` existir.
 *
 * Escrito como string, minusculo e sem dependencia, porque este e o unico
 * script que bloqueia a renderizacao da aplicacao inteira.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`

/**
 * Registrador de erros de script, para diagnostico. **Temporario.**
 *
 * Existe por causa de um relato que so acontece no aparelho de quem relata: no
 * celular, tudo que e `<a>` funciona e tudo que e `<button>` nao. Isso e o HTML
 * do servidor aparecendo sem o pacote do cliente subir — e a causa disso e um
 * erro que ninguem consegue ler sem console.
 *
 * Fica no `<head>`, e nao numa pagina, por dois motivos. Roda antes de tudo,
 * entao pega ate erro de analise do pacote, que acontece antes de qualquer
 * codigo nosso. E script dentro de componente React nao e reconciliado no
 * cliente: ele causa divergencia de hidratacao — a primeira versao desta sonda
 * acusava exatamente o erro que ela mesma criava.
 *
 * Guarda no maximo dez, para uma pagina que falha em laco nao virar vazamento.
 * Sai quando o diagnostico terminar.
 */
export const ERROR_RECORDER_SCRIPT = `(function(){var e=[];window.__colexaErros=e;function a(m){if(e.length<10){e.push(String(m).slice(0,300))}}window.addEventListener("error",function(v){a((v&&v.message)||"erro sem mensagem")},true);window.addEventListener("unhandledrejection",function(v){a("promessa recusada: "+((v&&v.reason)||""))})})();`

