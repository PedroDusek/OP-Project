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
 * celular, tudo que e `<a>` funcionava e tudo que e `<button>` nao. Isso e o
 * HTML do servidor aparecendo sem o pacote do cliente subir.
 *
 * ## Ele escreve sozinho, fora da arvore do React
 *
 * A primeira versao mostrava o resultado por um componente. Nao serve: se o
 * pacote nao sobe, quem deveria contar isso tambem nao roda, e a pagina jura
 * que esta tudo bem. Por isso este script cria o proprio painel e o pendura no
 * `<body>`, **fora** da raiz do React — que so reconcilia o que e dela.
 *
 * Fica no `<head>` para rodar antes de tudo, inclusive antes de um erro de
 * analise do pacote. Guarda no maximo dez erros, para uma pagina que falha em
 * laco nao virar vazamento. Sai quando o diagnostico terminar.
 */
export const ERROR_RECORDER_SCRIPT = [
  '(function(){',
  'var e=[];window.__colexaErros=e;',
  'function a(m){if(e.length<10){e.push(String(m).slice(0,300));p()}}',
  'window.addEventListener("error",function(v){a((v&&v.message)||"falha ao carregar um script")},true);',
  'window.addEventListener("unhandledrejection",function(v){a("promessa recusada: "+((v&&v.reason)||""))});',
  'function p(){',
  'var host=document.getElementById("colexa-sonda");',
  'if(!host){',
  'if(!document.body){return}',
  'host=document.createElement("div");',
  'host.id="colexa-sonda";',
  'host.setAttribute("style","margin:16px;padding:12px;border:1px solid #ccc;border-radius:12px;font:12px system-ui;white-space:pre-wrap;word-break:break-word");',
  'document.body.appendChild(host)',
  '}',
  // Sem quebra de linha: um `\n` de verdade dentro de uma string do script
  // gerado e erro de sintaxe, e o registrador quebrado nao consegue nem
  // denunciar a si mesmo. Separador visivel resolve e nao escapa nada.
  'host.textContent="JavaScript basico: rodou"+(e.length?(" | erros ("+e.length+"): "+e.join(" | ")):" | nenhum erro capturado")',
  '}',
  'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",p)}else{p()}',
  '})();',
].join('')
