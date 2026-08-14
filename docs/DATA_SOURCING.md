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
| 3 | **Grande varejista especializado** (Tennis Warehouse, Tennis Point) | confirmação cruzada de specs, existência de variantes/gauges |
| 4 | **Varejista brasileiro confiável** | `brazil_availability_status`, preço praticado |
| 5 | **Review técnico reconhecido** | apenas contexto qualitativo — **nunca** como fonte primária de número |

Regra: um campo assume o valor da fonte de **menor tier disponível** (tier 1 é o melhor). Não há
exceção, porque **todos** os campos do modelo v2 são publicados pelo fabricante.

> **O tier de laboratório saiu da hierarquia na v2.** Ele existia para alimentar `swingweight`,
> `twistweight`, `stiffness_ra` e `strung_weight` — campos que a metodologia v2 removeu
> (00_RISKS_AND_DECISIONS, RESOLUÇÃO v2). Um tier de fonte que não alimenta nenhum campo do modelo é
> um convite a preencher dados que o motor não deveria usar.

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
| `beam_width_mm` | Preenchido como string publicada (`'23/26/23'`) | Perfil da viga é publicado por todas as quatro marcas |
| Campos de laboratório | **Não existem no schema** | Removidos na v2. Ver 00_RISKS_AND_DECISIONS, RESOLUÇÃO v2 |
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
| `beam_width_mm` | ±0.5 mm em qualquer seção | tier 1 vence; divergência maior indica geração diferente |
| `length_in` | 0 | `disputed` |
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

---

## 10. Política de gerações — quais modelos entram no catálogo

Esta seção responde diretamente a duas perguntas: **o catálogo considera só modelos novos?** e **o que
é preciso para fazer a curadoria?**

### 10.1 Não, e não deveria

O catálogo semente atual (46 variantes) cobre principalmente **gerações correntes** — é o ponto de
partida natural, porque são as fichas técnicas mais fáceis de confirmar na fonte oficial. Mas tratar
"corrente" como critério de inclusão seria um erro de produto no mercado brasileiro, por três razões
concretas:

1. **Preço.** No Brasil a geração anterior costuma custar 30–50% menos que a corrente. Para boa parte
   dos jogadores, a raquete tecnicamente certa é a de 2021 que está em promoção — não a de 2025.
2. **Continuidade técnica.** Muitas gerações mudam material e pintura sem mudar peso, balanço, cabeça
   nem padrão. Quando as specs publicadas são iguais, a geração anterior é uma recomendação
   **igualmente boa** e mais barata. Esconder isso é vender pior por parecer mais moderno.
3. **A raquete atual do usuário.** O `transition_fit` e toda a análise do §22 só funcionam se o
   catálogo reconhecer o que a pessoa **já tem** — e o que ela tem quase nunca é o lançamento do ano.
   Um catálogo só de modelos novos degrada a análise de todo mundo que já joga.

Por isso o schema já distingue `status: 'current' | 'previous_generation' | 'discontinued'`, o filtro
duro exclui `discontinued` **exceto quando é a raquete atual do jogador**, e cada geração é uma linha
independente, verificada do zero. Nunca assumir que gerações têm specs idênticas — verificar sempre,
mesmo quando "é a mesma raquete com outra pintura".

**Estado honesto:** a cobertura de gerações anteriores no seed é parcial (Pure Drive 2021, Pure Aero
2023, Ultra v4 2022, Percept 2023 entre outras). Ampliá-la é trabalho de curadoria, não de engenharia
— o modelo já suporta.

### 10.2 O que a curadoria exige, concretamente

Para cada variante, por volta de **15 a 25 minutos** de trabalho humano:

| Passo | O que é preciso | Fonte |
|---|---|---|
| 1 | URL da ficha oficial do produto no site da marca | tier 1 |
| 2 | Conferir 8 campos publicados lado a lado com a URL aberta | tier 1 |
| 3 | Confirmação cruzada em 1 varejista especializado | tier 3 |
| 4 | `brazil_availability_status` em ≥ 2 varejistas nacionais | tier 4 |
| 5 | Foto do produto correto — variante E geração certas (§54) | tier 1 |
| 6 | `verified_at` + `confidence` + salvar | `/admin/verificacao` |

Os 8 campos do passo 2 são: `head_size_sq_in`, `length_in`, `unstrung_weight_g`, `balance_mm`,
`beam_width_mm`, `string_pattern_mains`, `string_pattern_crosses`, `recommended_tension_*`. **É toda a
lista.** Não há nada a medir, nada a inferir e nada que dependa de laboratório — essa foi a razão de
ser da metodologia v2.

**Estimativa para o catálogo atual:** 46 raquetes + 40 variantes de corda ≈ **20 a 30 horas** de
curadoria humana até `verified`, distribuíveis por prioridade. A fila de `/admin/verificacao` é
ordenada por impacto: variantes que aparecem no topo de mais simulações de persona vão primeiro, então
as primeiras ~8 horas já liberam a maior parte dos casos reais.

**O que NÃO é preciso:** nenhum equipamento, nenhuma máquina RDC, nenhuma parceria com laboratório,
nenhuma assinatura de base de dados paga. Só acesso aos sites oficiais e disciplina para não preencher
o que não foi conferido.

### 10.3 Cobertura por segmento — o teste que a curadoria precisa passar

Um catálogo 100% verificado ainda pode ser **inadequado**: se não existe frame de cabeça grande e leve,
o iniciante recebe a melhor opção *disponível*, que continua sendo uma opção ruim para ele. O
`fit_score` é relativo ao catálogo e não tem como saber disso.

`pnpm dataset:gate` reporta cobertura por segmento (`src/data/coverage.ts`). Estado atual:

| Segmento | Exigido | Encontrado |
|---|---|---|
| Iniciante — cabeça grande e leve (≥ 103 sq in **e** ≤ 285 g) | 3 | 5 |
| Conforto — perfil de quadro fino (≤ 22 mm médio) | 3 | 22 |
| Controle — padrão denso 18×20 | 2 | 5 |
| Avançado — frame pesado (≥ 310 g) | 2 | 6 |
| Spin — padrão aberto (≤ 16 mains) | 5 | 41 |

**Lacuna aberta e conhecida:** não há frame que seja simultaneamente *oversize* e de perfil fino. O
resultado é que a persona "iniciante COM histórico de desconforto" (p21) não atinge o piso de pódio e
o produto **se recusa a vender** para ela — comportamento correto, mas que representa demanda real não
atendida. Fechar essa lacuna é prioridade de curadoria, não de motor.
