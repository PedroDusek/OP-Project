# Marca

Nome do produto: **ColeXa**. Domínio: **colexa.com.br**, de propriedade do dono
do produto.

O símbolo é um **X formado por duas cartas cruzadas** — a forma vem do próprio
domínio do produto, o que é bom sinal para uma marca de app de coleção.

## Os arquivos em `originais/`

Quatro JPGs de 4500 px, dois do símbolo e dois do logotipo com o nome, cada um
em versão clara e escura. São a fonte da marca hoje.

**Eles não servem para a interface**, e vale saber por quê antes do Checkpoint 6:

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

## O que falta produzir

O símbolo é geometria pura: dois retângulos arredondados cruzados. Isso converte
para **SVG** muito bem — o mesmo desenho sairia de menos de 2 KB, contra os
1,8 MB do JPG, e escalaria de favicon a banner sem perder nitidez.

Para o Checkpoint 6 são necessários, em **RGB** e com transparência:

- `symbol.svg` — o X sozinho, para favicon, ícone de app e navegação compacta
- `logotype.svg` — nome e símbolo, para cabeçalho e páginas públicas
- PNG derivados nos tamanhos de favicon e ícone de app

Os originais ficam aqui como referência; os derivados de web vão para `public/`
quando o frontend existir.
