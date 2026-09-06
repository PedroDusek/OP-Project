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

| | |
|---|---|
| Símbolo | `#38277B` — índigo profundo |
| Fundo | `#F1F2F3` — cinza muito claro |

**Confirme esse índigo com quem desenhou.** Conversão de CMYK para RGB não é
única: depende do perfil de destino e da intenção de renderização. Uma
visualização ingênua do mesmo arquivo mostra um azul bem mais vivo, e a
diferença entre os dois é grande demais para ser adivinhada.

Esse valor vira o token de cor de ênfase do design system no Checkpoint 6, então
é melhor acertá-lo antes de espalhar pela interface.

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
