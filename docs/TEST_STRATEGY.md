# TEST_STRATEGY.md — Tennis Engineer

Status: `v1` · Runner: Vitest

---

## 1. Pirâmide

| Camada | Diretório | O que garante |
|---|---|---|
| Arquitetura | `tests/architecture/` | O motor não importa React/Next/DB/IA |
| Unidade | `tests/unit/` | Normalização, perfil, tensão, unidades, paridade com a doc |
| Propriedade | `tests/property/` | Determinismo, monotonicidade, limites |
| Persona | `tests/personas/` | Comportamento do sistema como um todo (§49, §61) |
| Integridade | `tests/integrity/` | Gauges reais, procedência, catálogo |
| Segurança | `tests/security/` | Entitlements, vazamento de dados premium |
| Ética | `tests/ethics/` | Qualidade do pódio, ausência de dark patterns |

---

## 2. Testes de arquitetura

`boundaries.test.ts` — falha se `src/recommendation/**` importar `react`, `next`, `src/app`,
`src/components`, `src/database` ou `src/ai`. O motor precisa rodar em CLI, teste e worker sem alteração.

---

## 3. Testes de propriedade

| Propriedade | Verificação |
|---|---|
| **Determinismo** | 200 perfis aleatórios × 2 execuções ⇒ ranking idêntico, score idêntico ao 6º decimal |
| **Monotonicidade — potência** | ↑ `power_need` nunca reduz o ranking de um frame com `power_score` maior, mantendo o resto fixo |
| **Monotonicidade — conforto** | ↑ `arm_sensitivity` nunca eleva um frame mais rígido acima de um mais flexível equivalente |
| **Limites** | Todo score derivado ∈ [0,100]; toda tensão ∈ [40,66] e dentro da faixa do frame |
| **Renormalização** | Remover um campo publicado (`beam_width_mm → null`) não muda o score em mais de 25 pontos e reduz `data_completeness` |
| **Simetria de unidades** | `lbs → kg → lbs` estável em ±0.05 |

---

## 4. Personas (§49 + §61: mínimo 20)

Cada persona é um `PlayerProfile` fixo em `tests/personas/fixtures/` com **asserções comportamentais** —
nunca "deve recomendar a raquete X" (isso quebraria a cada mudança de catálogo). Asserções são sobre
propriedades do resultado.

### As 6 obrigatórias (§49)

| # | Persona | Asserções |
|---|---|---|
| 1 | **Iniciante adulto**, swing lento, pouca potência | Top 3 com `power_score ≥ 60`, `demand_index ≤ 45`, `forgiveness ≥ 60`; **nenhum** frame ≥ 315 g; corda **não** poliéster |
| 2 | **Intermediário**, topspin, swing rápido, busca spin | Top 3 com `spin_score ≥ 65`, padrão aberto (`openness ≥ 0.45`); corda com `spin_score ≥ 70` |
| 3 | **Avançado**, chapado, busca controle | Top 3 com `control_score ≥ 70`, `precision ≥ 65`; ao menos um 18×20; `power_score ≤ 65` |
| 4 | **Recreativo com sensibilidade no braço** | **Nenhum** frame com `RA ≥ 68`; `arm_friendliness ≥ 65`; corda não-poly ou híbrida; tensão ≤ mediana − 2 lbs |
| 5 | **Intermediário agressivo**, 300 g atual, quer estabilidade | Top 1 com `stability_score` > da atual; `Δpeso ≤ 25 g`; `transition_fit ≥ 70` |
| 6 | **Frame pesado demais para a técnica**, quer algo mais fácil | Top 1 mais leve **e** com SW menor que o atual; `demand_index` menor; `maneuverability` maior |

### As 14+ complementares

7. Iniciante feminina, 1,60 m, sedentária · 8. Veterano 58 anos com histórico de cotovelo ·
9. Junior 15 anos avançado · 10. Intermediário sem raquete própria · 11. Avançado uma mão no backhand ·
12. Contra-atacante defensivo · 13. Serve-and-volley clássico · 14. Jogador que quebra corda semanalmente ·
15. Todos os "não sei" (confiança deve ser **Baixa**) · 16. Contradições no texto livre ·
17. Raquete atual não reconhecida · 18. Objetivos conflitantes (potência + controle) ·
19. Alta sensibilidade + swing muito rápido (conflito conforto × performance) ·
20. Jogador satisfeito ("potencializar meu jogo atual") — Top 1 deve ser **próximo** do atual, não uma
    revolução; `transition_fit ≥ 85`.

**Revisão manual (§61):** antes do lançamento comercial, o Top 10 de cada persona é revisado por um
profissional de tênis. Inconsistências viram ajustes de peso, documentados e versionados
(`RECOMMENDATION_ENGINE_VERSION`). O registro fica em `docs/CALIBRATION_LOG.md`.

---

## 5. Testes de integridade

`string-variants.test.ts` — **o teste mais importante do projeto** (Regra de Integridade):
500 perfis sintéticos; para cada recomendação de corda, verifica que
(a) o `string_variant_id` existe no catálogo,
(b) `brazil_availability_status ∈ {widely_available, available}` — ou `limited` **com aviso presente**,
(c) `verification_state = 'verified'`,
(d) o par `(model, gauge)` recomendado consta da lista de variantes reais daquele modelo.

`no-invented-specs.test.ts` — percorre o catálogo e falha se qualquer campo técnico tiver valor sem
entrada correspondente em `provenance`. Impede que um número entre "de carona" numa edição.

`dataset-gate.test.ts` — em modo `strict`, falha se qualquer variante recomendável não estiver `verified`.

`catalog-schema.test.ts` — todo JSON do seed valida contra o schema Zod e contra os `CHECK` de faixa
física (peso 200–400 g, RA 40–90, gauge 0.95–1.45 mm…).

---

## 6. Testes de segurança

`entitlements.test.ts`:
- sem entitlement → payload **não contém** `brand`, `model`, `image_url`, `specs`, `breakdown` de nenhum
  colocado (snapshot + varredura recursiva de strings por nomes de marcas do catálogo)
- `racket_report_access` → 1º completo; 2º e 3º apenas `{rank, fit_score, teaser, locked}`
- `top3_access` → os três completos
- `racket_report_access` sem `full_setup_access` → **nenhum** dado de corda ou tensão no payload
- concessão de entitlement só ocorre com `payments.status = 'paid'`

`webhook-idempotency.test.ts` — o mesmo evento entregue 5× concede exatamente 1 entitlement e cria
exatamente 1 pagamento.

`ai-guard.test.ts` — dado um `FactSheet` fixo e uma explicação contendo um número não autorizado
("swingweight 325" — grandeza que sequer existe no modelo v2), `guardFactualClaims()` **rejeita** e o sistema cai para o gerador determinístico.

---

## 7. Testes de ética

`podium-quality.test.ts` — se o 3º colocado tiver `fit_score < 75`, o pódio é reduzido e o upsell
`top3_unlock` **não é ofertado** (§30: proibido criar opções artificiais para vender o upsell).

`no-dark-patterns.test.ts` — varre os componentes por termos proibidos ("última chance", "oferta expira",
"restam", "apenas hoje") e falha se `products` ganhar qualquer campo de preço comparativo (§58).

---

## 8. Cobertura mínima

| Módulo | Alvo |
|---|---|
| `src/recommendation/**` | **95%** — é o produto |
| `src/payments/**` | 90% — envolve dinheiro |
| `src/domain/**` | 90% |
| `src/ai/**` | 80% (guard em 100%) |
| `src/app/**`, `src/components/**` | sem alvo — cobertos por E2E |

---

## 9. CI

```
pnpm typecheck  →  pnpm lint  →  pnpm test  →  pnpm dataset:gate  →  build
```

`dataset:gate` roda **antes** do build de produção. Um catálogo não verificado quebra o deploy — por
projeto, não por acidente.
