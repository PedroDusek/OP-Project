# Marca

Nome do produto: **ColeXa**. Domínio: **colexa.com.br**, de propriedade do dono
do produto.

A referência oficial é
[`COLEXA_Especificacao_Oficial_UI_Design_Marca_v1.2.docx`](COLEXA_Especificacao_Oficial_UI_Design_Marca_v1.2.docx),
aprovada como baseline em 06/09/2026: posicionamento, tom de voz, design system,
inventário das 36 telas, componentes, estados obrigatórios, acessibilidade e a
diretriz de propriedade intelectual. Como isso virou código está em
[`docs/design-system.md`](../design-system.md).

O símbolo é um **X formado por duas cartas cruzadas** — a forma vem do próprio
domínio do produto, o que é bom sinal para uma marca de app de coleção.

## Os arquivos em `originais/`

`COLEXA LOGO.ai` é o **arquivo mestre**: uma prancheta com todas as versões da
marca lado a lado — símbolo e logotipo, claro e escuro, duas cores e
monocromático. Apesar da extensão, é um PDF, e a marca está lá como curvas de
Bézier de verdade, não como imagem colocada. É dele que saem os arquivos de
interface.

Os quatro JPGs de 4500 px, mais `COLEXA LOGO.jpg`, são exportações de impressão
do mesmo desenho.

**Os JPGs não servem para a interface**, e vale saber por quê:

| Problema | Consequência |
|---|---|
| Espaço de cor **CMYK**, perfil `Coated FOGRA39 (ISO 12647-2:2004)` | É perfil de impressão offset. Navegadores tratam JPEG CMYK de forma inconsistente: alguns renderizam com cor errada |
| **JPG**, sem transparência | O fundo claro fica gravado no arquivo. Sobre qualquer superfície que não seja exatamente aquele cinza, aparece um retângulo |
| **4500 px**, 1,3 a 1,8 MB cada | Resolução de impressão. Numa página web, é peso puro |

## Cor da marca

Convertendo o original de CMYK para RGB pelo perfil embutido:

Confirmada pelo dono do produto:

| Token | Claro | Escuro |
|---|---|---|
| Fundo | `#F2F2F3` | `#131219` |
| Roxo (ênfase) | `#38287B` | `#504797` |
| Texto | `#000000` | `#FFFFFF` |

**O roxo muda entre os temas.** `#504797` não é `#38287B` clareado por filtro: é
mais claro e menos saturado, escolhido para manter contraste sobre o fundo
escuro. São dois tokens distintos, e nenhuma regra de CSS deve derivar um do
outro.

A conversão do CMYK pelo perfil embutido havia dado `#38277B` — um dígito do
valor real. O perfil estava correto, e a diferença que eu via numa visualização
crua era o renderizador, não o arquivo.

## Os arquivos de interface

Produzidos no Checkpoint 6, em RGB e com transparência:

| Arquivo | Uso | Tamanho |
|---|---|---|
| `public/marca/symbol.svg` | o X sozinho: favicon, ícone, navegação compacta | 1,4 KB |
| `public/marca/logotype.svg` | nome e símbolo: cabeçalho e páginas públicas | 2,1 KB |
| `src/app/icon.svg` | favicon (cópia do símbolo, convenção do Next) | 1,4 KB |
| `src/app/apple-icon.png` | ícone de app do iOS, 180 px, com fundo | 8 KB |
| `public/marca/icon-192.png`, `icon-512.png` | manifesto de app instalável | 7 e 15 KB |
| `src/lib/marca.ts` | as mesmas curvas, para os componentes React | 3,5 KB |

Contra 1,8 MB do JPG do símbolo. E escalam de favicon a banner sem perder
nitidez, porque são as curvas do arquivo mestre — nada foi traçado nem
aproximado.

### Como regenerar

```
node scripts/marca/gen.mjs
```

Lê `originais/COLEXA LOGO.ai`, separa as versões da marca pela forma (não pela
posição na prancheta), converte as curvas e escreve todos os arquivos acima.
Roda sob demanda, nunca no build. Exige `sharp`, que já vem com o Next.

As **cores são substituídas** na conversão: o arquivo mestre está em CMYK de
impressão, e nenhuma conversão automática vale mais que os valores que o dono do
produto confirmou.

### Tema no próprio arquivo

Os SVGs carregam os dois temas dentro deles, com `prefers-color-scheme`: um
arquivo servido cru — favicon, ícone de app, `<img>` — não recebe o CSS da
página.

Na interface, porém, a marca é **inline** (`src/components/brand/logo.tsx`), e
não `<img>`. O motivo é que o arquivo servido só enxerga a preferência do
sistema, e erraria sempre que a pessoa escolhesse um tema diferente dele. Inline,
as letras herdam `currentColor` e o X usa o token de ênfase.
