# MONETIZATION.md — Tennis Engineer

Status: `v1` · Mercado: Brasil · Moeda: BRL

---

## 1. Produtos (§25, §26, §30, §34)

| SKU | Nome comercial | Preço | Entitlements |
|---|---|---|---|
| `racket_report` | Descubra sua raquete ideal | R$ 19,99 | `racket_report_access` |
| `full_setup` | Descubra seu setup completo | R$ 49,99 | `racket_report_access` + `full_setup_access` |
| `top3_unlock` | Desbloquear Top 3 | R$ 9,99 | `top3_access` |

Preços vivem na tabela `products` e são editáveis em `/admin/precos`. **Zero preço hardcoded** (§34).
O valor é copiado para `orders.amount_cents` no momento da compra — mudar o preço nunca reescreve o
histórico.

### Conteúdo por produto

**`racket_report` — R$ 19,99**
- Análise completa do jogador (perfil técnico traduzido em linguagem simples)
- Melhor raquete recomendada: marca, modelo, variante, geração
- Fit Score + índices Tennis Engineer (controle/spin/potência/conforto/estabilidade)
- Justificativa personalizada · Benefícios · Pontos de atenção
- Comparação com a raquete atual (§22), se informada
- Pódio com 2º e 3º **bloqueados** (Fit Score e frase de posicionamento visíveis)
- ❌ Não inclui corda, gauge ou tensão

**`full_setup` — R$ 49,99** · exibido como **ANÁLISE COMPLETA**
- Tudo do `racket_report`
- Corda: marca, modelo, tipo · Gauge (variante real) · Tensão inicial em lbs e kg · Faixa sugerida
- Por que essa raquete / essa corda / essa tensão / por que a combinação funciona
- O que você deve sentir em quadra
- Como ajustar no próximo encordoamento
- Análise de conforto

**`top3_unlock` — R$ 9,99** (upsell pós-resultado, §30)
- Libera 2º e 3º: nomes, fotos, Fit Scores, justificativas, trade-offs
- Tabela comparativa completa das três (§31)
- Rótulos por critério real: "Melhor escolha geral" / "Melhor se você priorizar controle" /
  "Melhor se você priorizar potência, conforto ou spin" — as categorias derivam dos atributos reais das
  três raquetes, nunca de rótulos fixos

---

## 2. Funil (§27)

```
landing_viewed
  → quiz_started → quiz_step_completed ×7 → quiz_completed
  → analysis_completed            (tela de processamento §63)
  → pricing_viewed                (teaser: nº real de raquetes analisadas + 3 matches + confiança)
  → racket_plan_selected | full_setup_selected
  → checkout_started → payment_completed
  → result_viewed
  → top3_offer_viewed → top3_checkout_started → top3_unlocked
  → result_shared | feedback_submitted
```

O questionário é **sempre gratuito**. O paywall fica entre a análise e o resultado.

### O que é mostrado antes do pagamento

```
Análise concluída

✓ Perfil físico analisado          ✓ Estilo de jogo mapeado
✓ Nível técnico calibrado          ✓ Equipamento atual comparado
✓ Swing analisado                  ✓ Objetivo interpretado

Avaliamos 47 raquetes e 31 variantes de corda disponíveis no Brasil.
Encontramos 3 raquetes com alta compatibilidade com seu jogo.
Confiança da análise: Alta

[ Ver minha raquete — R$ 19,99 ]   [ Ver meu setup completo — R$ 49,99 ]
```

Os números são **contagens reais da sessão**, lidas de `recommendation_sessions.candidates_evaluated`.
O nome da raquete não aparece (§27.5).

---

## 3. Ética comercial (§57, §58) — regras aplicadas em código

| Proibido (§58) | Como é impedido |
|---|---|
| Cronômetro falso | Não existe componente de contagem regressiva no projeto |
| "Última chance" / falsa escassez | Copy revisada; termos proibidos verificados por lint de conteúdo |
| Desconto fictício / preço "de/por" | `products` não tem campo `compare_at_price`. Impossível de exibir. |
| Recomendações falsas | Ranking é determinístico e auditável; sem campo de "patrocinado" |
| Fit Scores inventados | Todo score exibido tem `ScoreBreakdown` persistido; a UI lê do payload da API |
| Opções fracas para vender o upsell | `tests/ethics/podium-quality.test.ts`: se o 3º tiver `fit < 75`, o pódio encolhe e o upsell **não é ofertado** |

O valor comercial vem da profundidade da análise (§57): antes de pagar, o usuário vê **quanto** foi
analisado; depois de pagar, recebe um relatório visualmente rico e tecnicamente justificado.

---

## 4. Entitlements (§32)

```ts
type Entitlement = 'racket_report_access' | 'full_setup_access' | 'top3_access';
```

Concedidos **exclusivamente** por webhook confirmado (`payments.status = 'paid'`) ou reconciliação ativa
via `getPaymentStatus()`. Nunca pelo retorno do browser.

### Aplicação no servidor

```ts
// src/app/api/recommendations/[id]/route.ts
const ents = await getEntitlements(sessionId, recommendationSessionId);
return NextResponse.json(serializeRecommendation(rec, ents));
```

`serializeRecommendation` é a **única** função capaz de produzir o payload, e ela constrói o objeto a
partir dos entitlements — não filtra um objeto completo. Sem `top3_access`, o 2º e o 3º colocados são:

```json
{ "rank": 2, "fit_score": 91, "teaser": "Alternativa com um pouco mais de controle", "locked": true }
```

Sem `brand`, `model`, `image_url`, `specs` ou `breakdown`. Verificado por
`tests/security/entitlements.test.ts`, que faz snapshot do JSON e falha se qualquer identificador de
produto aparecer. Nunca ocultação por CSS (§32).

---

## 5. Pagamentos (§33)

### Abstração

```ts
interface PaymentProvider {
  readonly id: string;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  parseWebhook(req: Request): Promise<PaymentEvent | null>;   // valida assinatura; null = inválido
  getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus>;
}
```

Adapters: **`mercadopago`** (PIX + cartão — padrão para o Brasil), **`stripe`** (futuro/internacional),
**`fake`** (dev e testes E2E). Nenhuma regra de negócio importa um gateway diretamente; a seleção é por
`PAYMENT_PROVIDER` em env.

### Máquina de estados

```
pending ──paid──→ paid ──refunded──→ refunded
   ├──failed──→ failed
   └──cancelled──→ cancelled
```

Transições ilegais são rejeitadas por `assertTransition()`. `paid` é terminal exceto por `refunded`
(que revoga entitlements com `revoked_at`).

### Idempotência do webhook

```sql
INSERT INTO payment_events (provider, provider_event_id, event_type, payload)
VALUES ($1,$2,$3,$4) ON CONFLICT (provider, provider_event_id) DO NOTHING RETURNING id;
```

Só processa se houve `RETURNING id`. Reentrega do gateway (garantia at-least-once) é absorvida sem
duplicar entitlement nem pedido. A concessão do entitlement usa
`ON CONFLICT (session_id, recommendation_session_id, entitlement) DO NOTHING`.

### PIX

Fluxo assíncrono: `pending` → usuário paga → webhook `paid`. A tela de checkout faz polling do status
com backoff e um fallback de reconciliação (`getPaymentStatus`) após 60 s, cobrindo webhook perdido.

---

## 6. Métricas (§50)

Negócio: conversão por etapa, abandono por etapa do quiz, ticket médio, split `racket_report` vs
`full_setup`, taxa de upsell `top3`, receita por sessão.

Produto: raquetes mais recomendadas (alerta de concentração — se um modelo aparecer em > 25% dos
resultados, o algoritmo é auditado), cordas mais recomendadas, Fit Score médio, distribuição de confiança.

**Métrica central: RSS** (§67) — ver `PRODUCT_SPEC.md` §8. Nenhuma otimização de funil é aprovada se
degradar o RSS.

---

## 7. Reembolso

Política simples e honesta: reembolso integral em até 7 dias (Código de Defesa do Consumidor, art. 49 —
compra a distância). Processado pelo gateway; o webhook `refunded` revoga entitlements definindo
`revoked_at`. O relatório deixa de ser acessível, mas a `recommendation_session` é preservada para
análise agregada.
