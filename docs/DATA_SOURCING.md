# DATA_SOURCING.md — Tennis Engineer

Status: `v1` · `DATASET_VERSION = 2026.08.0` · Estado atual: **`pending_verification`**

> Este documento define como um número entra no banco. É a política que impede o produto de vender
> ficção técnica. Leia junto com `docs/00_RISKS_AND_DECISIONS.md#r-01`.

---

## 1. A regra

**Nunca inventar valor ausente. `null` é melhor que um número falso** (§7, §69).

Um assistente de IA reproduzindo uma especificação de memória **não é uma fonte**. Nenhum valor entra no
catálogo por lembrança, inferência, analogia com outro modelo, ou "deve ser mais ou menos isso".

---

## 2. Hierarquia de fontes (§7 + Regra de Integridade)

| Tier | Fonte | Usar para |
|---|---|---|
| 1 | **Fabricante** — site oficial, catálogo, ficha do produto | head size, comprimento, peso não encordoado, balanço, padrão, faixa de tensão, tamanhos de cabo, gauges oficiais da corda |
| 2 | **Distribuidor oficial no Brasil** | disponibilidade nacional, gauges comercializados no país |
| 3 | **Laboratório / medição especializada** (RDC, Babolat RDC) | swingweight, twistweight, RA, peso encordoado |
| 4 | **Grande varejista especializado** | confirmação cruzada de specs, existência de variantes/gauges |
| 5 | **Varejista brasileiro confiável** | `brazil_availability_status` |
| 6 | **Review técnico reconhecido** | apenas contexto qualitativo — **nunca** como fonte primária de número |

Regra: um campo assume o valor da fonte de **menor tier disponível** (tier 1 é o melhor). Exceção: para
`swingweight`, `twistweight` e `stiffness_ra`, o tier 3 **supera** o tier 1, porque o fabricante não
publica esses valores.

---

## 3. Estados de verificação

```
draft ──► pending_verification ──► verified
                   │
                   └──► disputed  (fontes divergem além da tolerância)
```

| Estado | Significado | Recomendável? |
|---|---|---|
| `draft` | Registro criado, sem fonte anexada | ❌ |
| `pending_verification` | Valor de catálogo do fabricante, ainda sem checagem humana da URL | ❌ em produção |
| `verified` | Humano abriu a fonte, conferiu, colou a URL e datou | ✅ |
| `disputed` | Divergência registrada, aguardando política | ❌ |

**Trava de release** (`scripts/dataset-gate.ts`, roda no CI):

```
FALHA o build de produção se qualquer variante com status='current' referenciada
pelo motor tiver verification_state != 'verified'.
```

Em desenvolvimento, `DATASET_MODE=permissive` libera `pending_verification` para permitir trabalhar no
motor — mas `NODE_ENV=production` força `strict`, sem override.

---

## 4. Estado atual e honesto do catálogo

O repositório entrega o **schema, o motor, os testes e o fluxo completos**, com um catálogo semente em
`pending_verification`:

| Categoria de campo | Estado no seed | Motivo |
|---|---|---|
| `head_size`, `length`, `unstrung_weight`, `balance_mm`, `string_pattern`, `recommended_tension` | Preenchido, `source_tier: manufacturer`, `confidence: medium`, `verified_at: null` | São dados de catálogo publicados; precisam de conferência humana contra a URL oficial |
| `swingweight`, `twistweight`, `stiffness_ra`, `strung_weight` | **`null`** | Não são publicados pelo fabricante. Só entram via tier 3 com URL. |
| `brazil_availability_status` | `unknown` | Exige checagem de varejo nacional |
| Scores derivados | Calculados | São função dos acima; degradam graciosamente com `null` (R-02) |

Isto **não é um catálogo pronto para vender**. É um catálogo pronto para ser verificado, com a
ferramenta de verificação já construída (`/admin/verificacao`). A fila de verificação é priorizada por
impacto: variantes que aparecem no topo de mais simulações de persona são verificadas primeiro.

---

## 5. Procedimento de verificação (por variante)

1. Abrir `/admin/verificacao` → próxima variante da fila.
2. Para cada campo, abrir a URL da fonte e conferir o valor exibido lado a lado.
3. Divergência dentro da tolerância → aceitar tier mais alto e registrar em `data_revisions`.
4. Divergência fora da tolerância → marcar `disputed`, aplicar política (§6), registrar.
5. Preencher `source_url` + `verified_at` + `confidence`.
6. Verificar `brazil_availability_status` em pelo menos 2 varejistas nacionais.
7. Salvar → recalcula `racket_attributes` e `racket_fit_profiles` automaticamente.

**Tolerâncias entre fontes**

| Campo | Tolerância | Ação se exceder |
|---|---|---|
| `head_size` | 0 sq in | `disputed` — divergência aqui significa variante diferente |
| `unstrung_weight` | ±3 g | tier mais alto vence |
| `balance_mm` | ±3 mm | tier mais alto vence |
| `swingweight` | ±6 | mediana das medições de tier 3 |
| `stiffness_ra` | ±2 | mediana das medições de tier 3 |
| `string_pattern` | 0 | `disputed` |
| `recommended_tension` | ±2 lbs | tier 1 vence sempre |

Tolerâncias reconhecem variação real entre exemplares (±5 SW é normal), sem virar licença para aceitar
qualquer número.

---

## 6. Política de divergência (§7)

```
1. Tier mais alto vence, respeitada a exceção de lab para SW/TW/RA.
2. Empate de tier → mediana dos valores.
3. Divergência acima da tolerância → verification_state = 'disputed', campo mantido null,
   variante sai do pool recomendável até resolução.
4. TODA divergência gera linha em data_revisions com policy_applied e divergence_note.
```

Histórico nunca é apagado. É possível responder "por que este swingweight mudou em março?".

---

## 7. Cordas — a regra dos gauges

> Nunca inferir que um gauge existe porque outra corda da mesma família o tem. Nunca inferir que todas as
> versões de uma linha compartilham os mesmos gauges.

Cada `string_variant` (`marca + modelo + gauge`) exige:

- `source_tier ∈ {manufacturer, official_distributor, major_retailer, br_retailer}`
- `source_url` apontando para a página **daquela espessura específica**
- `last_verified_at`
- `brazil_availability_status` conferido em ≥ 2 varejistas nacionais

Se a corda XPTO existe oficialmente só em 1.20 e 1.25, a variante 1.30 **não existe no catálogo** — e
portanto é inalcançável pelo motor, mesmo que 1.30 fosse tecnicamente ideal (R-06). O teste
`tests/integrity/string-variants.test.ts` roda 500 perfis sintéticos e falha se qualquer recomendação
apontar para um `string_variant_id` inexistente ou indisponível no Brasil.

### `global_availability` vs `brazil_availability_status`

Campos separados e independentes. Uma variante pode ser `widely_available` globalmente e `not_found` no
Brasil — nesse caso ela **não é recomendada**. Variantes `limited` só entram quando há mérito técnico
relevante, e sempre com aviso visível ao usuário.

---

## 8. Marcas na v1

**Raquetes** (§5): HEAD · Wilson · Babolat · Yonex. Alvo: 30–50 variantes, priorizando famílias adultas
relevantes e encontráveis no Brasil.

**Cordas** (§8): Luxilon · Solinco · Babolat · HEAD · Yonex · Wilson · Tecnifibre. Alvo: 15–25 modelos,
com variantes de gauge **reais**. Evitar cordas obscuras ou difíceis de comprar no Brasil.

Separação de variantes e gerações é obrigatória (§5): 305 g ≠ 285 g; 2023 ≠ 2025 ≠ 2026. Nunca assumir
que gerações têm specs idênticas — cada geração é uma linha nova, verificada do zero.

---

## 9. Atualização periódica

- **Trimestral:** revisar `status` (novas gerações → anterior vira `previous_generation`).
- **Semestral:** revalidar `brazil_availability_status`.
- **Sob demanda:** lançamento de nova geração → nova variante, jamais editar a antiga.
- `last_verified_at` > 12 meses → variante entra automaticamente na fila de reverificação e sua
  `confidence` é rebaixada um nível.

`DATASET_VERSION` (`AAAA.MM.N`) incrementa a cada publicação e é gravada em toda recomendação (§61),
permitindo reproduzir qualquer relatório histórico.
