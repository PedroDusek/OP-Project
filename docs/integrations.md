# Integrações

Dado externo entra no sistema por duas interfaces, e nunca pelo caminho da
requisição. Concluída uma importação, o banco interno é a fonte operacional de
verdade. Nenhuma API externa é chamada durante a renderização de uma página.

---

## 1. Situação

**Nenhuma fonte externa está aprovada.** Tanto a fonte do catálogo quanto a fonte
de preços são decisões em aberto.

Nada neste documento presume que alguma API específica exista, que algum endpoint
tenha determinado formato, ou que raspagem de qualquer site seja permitida. Antes
de qualquer fonte ser implementada, é preciso verificar e registrar aqui:

- a documentação e o formato real da resposta;
- disponibilidade e estabilidade;
- termos de uso e licença;
- se o acesso automatizado é permitido;
- limites de taxa e a frequência aceitável de atualização;
- exigências de atribuição.

Se uma fonte preferencial se mostrar inviável, alternativas são apresentadas para
decisão, jamais substituídas silenciosamente.

---

## 2. Catálogo

Fontes candidatas citadas na especificação, em ordem de prioridade, todas
pendentes de avaliação:

1. `optcg-data` e outros dados derivados da fonte oficial Bandai
2. Scrydex
3. qualquer outra, somente após avaliação

### 2.1 Interface

```ts
interface CatalogProvider {
  readonly name: string
  fetchSets(): Promise<SetDTO[]>
  fetchCards(): Promise<CardDTO[]>
  fetchVariants(): Promise<VariantDTO[]>
}
```

Os DTOs são o formato interno normalizado, não o formato de nenhum provedor. Cada
implementação é responsável por traduzir o próprio payload para eles, de modo que
uma troca de fonte não alcance o resto do sistema.

### 2.2 Pipeline

```
buscar -> normalizar -> validar -> upsert (transacional) -> relatar
```

A normalização mapeia o vocabulário do provedor para as tabelas de vocabulário
internas. Classificações nunca são inventadas: um valor que não corresponda a uma
cor, trait, atributo, mecânica ou efeito conhecido é rejeitado e reportado, não
adivinhado.

A validação rejeita o registro em vez de importar algo malformado. Registros
rejeitados são contados e registrados em log com o motivo.

### 2.3 Idempotência

Rodar a importação duas vezes não pode duplicar cards, variants, sets, cores,
traits, atributos, mecânicas, efeitos ou printings.

| Entidade | Chave de correspondência | Situação |
|---|---|---|
| `cards` | `code` | única e confiável |
| `sets` | `code` | única e confiável |
| tabelas de vocabulário | `name` | única desde a decisão 014 |
| `variant_printings` | `(card_variant_id, set_id)` | chave primária composta |
| `card_variants` | **não resolvida** | ver abaixo |

### 2.4 O problema da identidade da variante

`card_variants` não tem chave natural. O código identifica a carta, não a
variante, e uma mesma carta pode ter várias alternate arts distintas com o mesmo
`variant_type`, então `(card_id, variant_type)` não é único. Criar um número de
variante artificial é proibido pela especificação.

Como consequência, uma segunda execução da importação não tem como decidir com
segurança se uma variante recebida é alguma que já foi gravada. Casar pela URL da
imagem é frágil, porque URLs mudam; casar por raridade mais tipo colide
exatamente no caso de alternate art que importa.

Este é o cenário que a especificação antecipa ao permitir identificadores
externos no modelo físico. Qualquer identificador desse tipo:

- não substitui a chave primária interna;
- não é usado como identificador público;
- existe apenas para tornar a sincronização determinística.

A proposta concreta vem no Checkpoint 3, depois que uma fonte real for avaliada e
seus identificadores forem conhecidos. Até lá a importação não pode ser tornada
idempotente para variantes, e o Checkpoint 3 não começa.

### 2.5 Imagens

As imagens das cartas são referenciadas por URL em `card_variants.image_url`. Se
podem ser consumidas diretamente da origem ou precisam ser armazenadas
localmente depende dos termos da fonte aprovada, e é decidido junto com ela.

---

## 3. Preços

O objetivo é preço de mercado para o Brasil. A LigaOnePiece é a fonte
preferencial quando existir integração real, tecnicamente disponível e
permitida.

Nada disso está estabelecido. Nenhuma API é presumida como existente e nenhuma
raspagem é presumida como permitida. Isso é verificado antes do Checkpoint 11, e
alternativas são apresentadas caso a fonte preferencial não possa ser usada.

### 3.1 Interface

```ts
interface PriceProvider {
  readonly name: string
  readonly currency: string
  fetchPrices(refs: VariantRef[]): Promise<PriceDTO[]>
}
```

A abstração existe para que a fonte possa mudar sem tocar na lógica de valoração.
Preços são gravados em `card_prices` como novas linhas com `captured_at`; linhas
existentes nunca são atualizadas, porque o valor histórico dos trades é resolvido
a partir desse histórico.

### 3.2 Um provedor por vez

`card_prices` não tem coluna identificando o provedor. Isso basta enquanto
exatamente um provedor estiver ativo. Suportar mais de um simultaneamente exigiria
uma coluna, o que é alteração do modelo aprovado e seria levantado antes de
qualquer implementação.

---

## 4. Observabilidade

Toda execução de importação registra, como eventos estruturados:

- início, com o nome do provedor e o identificador da execução;
- contagens de registros processados, inseridos, atualizados, rejeitados e com
  falha;
- cada rejeição com o motivo e os campos que identificam o registro;
- término, com a duração e as contagens finais.

Logs nunca contêm credenciais, tokens ou dados pessoais.
