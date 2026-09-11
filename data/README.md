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
