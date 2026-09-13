# `data/`

Dados que o código aplica, e não que o código calcula.

## `vinculos-manuais.json`

Qual produto da fonte de preço é cada arte paralela que só o olho resolve
(decisão 068). A importação de preço aplica este arquivo como `origin = 'manual'`
em qualquer ambiente — `npm run prices:import` no local, `npm run supabase
prices` em produção —, e vínculo manual nunca é sobrescrito por regra (053).

```json
{
  "fonte": "tcgcsv",
  "vinculos": [
    { "variante": "OP01-016_p3", "produto": "512345" },
    { "variante": "OP01-016_p7", "produto": null, "nota": "a fonte não tem esta arte" }
  ]
}
```

- `variante` é o `source_id` da Bandai, e não o id do banco: ele sobrevive a um
  catálogo reimportado.
- `produto: null` é uma resposta — "olhei, e a fonte não tem" —, e não ausência.
  Sem ela, a arte voltaria para a fila de mapeamento para sempre.
- Uma arte aponta para um produto só, e um produto pertence a uma arte só. O
  arquivo é recusado inteiro se isso não valer, com o nome do que repetiu.
- Tirar uma linha do arquivo **não** apaga o vínculo no banco. Para desfazer um
  mapeamento, troque o produto ou ponha `null`.

O arquivo é gravado pela tela `/dev/paralelas`, que só existe fora de produção.
Editar à mão também serve; a importação confere o formato antes de aplicar.

## `liga-cartas.json`

Qual é a página da LigaOnePiece de cada arte, conferida por gente, coleção a
coleção (decisão 071). A página da carta usa este endereço no botão "Veja na
Liga"; a paralela que não está aqui vai para a busca da Liga.

```json
{
  "cartas": [
    { "arte": "OP01-001_p1", "url": "https://www.ligaonepiece.com.br/?view=cards/card&card=Roronoa+Zoro%20(OP01-001-PAR)&ed=OP-01&num=OP01-001-PAR" },
    { "arte": "OP01-004_p1", "url": null, "nota": "a Liga não tem página desta arte" }
  ]
}
```

- `arte` é o `source_id` da Bandai.
- `url` é o endereço **como a Liga o produziu**, colado da barra do navegador.
  Não é remontado: o nome dentro dele nem sempre é o nosso.
- `url: null` é uma resposta — "conferi, e a Liga não tem página".
- A normal que não está aqui continua com o endereço montado sem sufixo; entra
  aqui só a exceção, ou a amostra por raridade da coleção.

O arquivo é gravado pela tela `/dev/liga?set=OP01`, que só existe fora de
produção. Editar à mão também serve; um teste lê o arquivo e reprova a CI se ele
estiver inválido.
