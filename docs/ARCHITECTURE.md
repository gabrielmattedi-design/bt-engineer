# ARCHITECTURE.md — Tennis Engineer

Status: `v1`

---

## 1. Stack

| Camada | Escolha | Justificativa |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 | SSR para SEO futuro, Server Actions para o questionário, streaming na tela de processamento |
| Linguagem | TypeScript `strict` + `noUncheckedIndexedAccess` | O domínio é numérico e cheio de `null` legítimo; o compilador é a primeira linha de defesa |
| Estilo | Tailwind CSS v4 + tokens de design | Ver `docs/DESIGN.md` |
| Componentes | Primitivas shadcn/ui escritas à mão (Radix + CVA) | Mesma API do shadcn sem dependência de CLI/rede |
| Banco | PostgreSQL (Supabase) | `numeric` exato para dinheiro, `jsonb` para breakdowns de auditoria |
| ORM | Drizzle | Schema tipado em TS, migrações versionadas, sem runtime pesado |
| Validação | Zod | Fronteira única entre I/O não confiável e o domínio |
| IA | Anthropic SDK (`claude-sonnet-5`) | Extração estruturada via tool use; opcional em runtime |
| Testes | Vitest | Unit + propriedade + integridade + segurança |
| Deploy | Vercel | Edge para landing, Node runtime para motor e webhooks |

---

## 2. Regra fundamental: UI e lógica não se tocam

```
src/domain/          ← tipos, escalas, unidades. ZERO dependências.
src/recommendation/  ← motor puro. Depende só de domain. ZERO I/O, ZERO React, ZERO fetch.
src/ai/              ← camada opcional. Entra e sai por interfaces do domain.
src/data/            ← catálogo + loaders + validação de procedência.
src/database/        ← Drizzle schema, migrações, repositórios.
src/payments/        ← abstração de gateway + adapters.
src/app/             ← rotas. Orquestra. Não calcula nada.
src/components/      ← apresentação. Recebe view models prontos.
```

**Teste arquitetural** (`tests/architecture/boundaries.test.ts`): falha o build se
`src/recommendation/**` importar qualquer coisa de `react`, `next`, `src/app`, `src/components`,
`src/database` ou `src/ai`. O motor precisa rodar num script de CLI, num teste e num worker sem
modificação — é isso que torna o simulador do admin (§47) trivial e confiável.

---

## 3. Estrutura de diretórios

```
tennis-engineer/
├── docs/                                 # os 10 documentos + riscos + design
├── drizzle/                              # migrações SQL geradas
├── scripts/
│   ├── seed.ts                           # popula o banco a partir de src/data
│   ├── dataset-gate.ts                   # trava de release (R-01)
│   └── simulate.ts                       # roda personas na CLI
├── src/
│   ├── app/
│   │   ├── (marketing)/
│   │   │   ├── page.tsx                  # landing (§40, §41, §42)
│   │   │   └── como-funciona/page.tsx
│   │   ├── questionario/
│   │   │   ├── page.tsx                  # shell mobile-first
│   │   │   └── [step]/page.tsx
│   │   ├── analise/[sessionId]/page.tsx  # processamento + teaser (§27, §63)
│   │   ├── planos/[sessionId]/page.tsx   # pricing (§25, §26)
│   │   ├── checkout/[orderId]/page.tsx
│   │   ├── resultado/[sessionId]/page.tsx# relatório + pódio (§35, §36, §28)
│   │   ├── setup/[publicId]/page.tsx     # share público sanitizado (§53)
│   │   ├── admin/
│   │   │   ├── raquetes/                 # CRUD + variantes + gerações
│   │   │   ├── cordas/
│   │   │   ├── verificacao/              # fila de procedência
│   │   │   ├── simulador/                # §47
│   │   │   ├── precos/                   # §34
│   │   │   └── feedback/
│   │   └── api/
│   │       ├── sessions/route.ts
│   │       ├── recommendations/[id]/route.ts     # serialização por entitlement
│   │       ├── checkout/route.ts
│   │       ├── webhooks/[provider]/route.ts      # idempotente
│   │       ├── catalog/rackets/search/route.ts   # autocomplete (§15)
│   │       └── feedback/route.ts
│   ├── components/
│   │   ├── ui/                           # primitivas
│   │   ├── quiz/                         # cards, progress, seleção visual
│   │   ├── result/                       # pódio, radar, comparativo
│   │   └── marketing/
│   ├── domain/
│   │   ├── units.ts                      # lbs ↔ kg, mm ↔ pts, sq in
│   │   ├── scores.ts                     # Score0to100, clamp, norm, lerp
│   │   ├── sourced.ts                    # Sourced<T>, confiança, procedência
│   │   ├── racket.ts
│   │   ├── string.ts
│   │   ├── player-profile.ts
│   │   └── recommendation.ts
│   ├── recommendation/
│   │   ├── config/
│   │   │   ├── weights.v1.ts             # pesos + rationale obrigatório
│   │   │   └── version.ts
│   │   ├── normalize/
│   │   │   ├── racket-attributes.ts      # camada 2
│   │   │   └── string-attributes.ts
│   │   ├── profile/
│   │   │   ├── build-profile.ts          # camada 3
│   │   │   └── calibration.ts            # nível objetivo vs. percebido
│   │   ├── engine/
│   │   │   ├── fit-components.ts
│   │   │   ├── penalties.ts
│   │   │   ├── hard-filters.ts
│   │   │   ├── rank-rackets.ts           # camada 4
│   │   │   └── transition.ts             # §22
│   │   ├── strings/
│   │   │   ├── select-string.ts          # §37 — variantes reais apenas
│   │   │   └── tension.ts                # §9
│   │   ├── confidence.ts                 # §24
│   │   └── explain/
│   │       ├── fact-sheet.ts             # fatos autorizados para a IA
│   │       └── deterministic.ts          # fallback sem IA
│   ├── ai/
│   │   ├── client.ts
│   │   ├── extract-free-text.ts          # §19
│   │   ├── generate-explanation.ts
│   │   └── guard.ts                      # validador anti-alucinação (R-03)
│   ├── data/
│   │   ├── rackets/*.json
│   │   ├── strings/*.json
│   │   ├── sources.json
│   │   └── load.ts                       # valida com Zod na carga
│   ├── database/
│   │   ├── schema/*.ts
│   │   └── repositories/*.ts
│   ├── payments/
│   │   ├── provider.ts                   # interface
│   │   ├── adapters/{mercadopago,stripe,fake}.ts
│   │   └── entitlements.ts               # assertEntitlement
│   ├── analytics/events.ts               # §50
│   └── lib/
└── tests/
    ├── unit/  personas/  integrity/  security/  ethics/  architecture/
```

---

## 4. Fluxo de dados de uma recomendação

```
1. POST /api/sessions                → cria anonymous_session (cookie httpOnly assinado)
2. Server Action por etapa           → questionnaire_answers (append-only, auditável)
3. Fim do questionário
   3a. ai.extractFreeText()          → ProfileSignal[]  (opcional; falha → segue sem)
   3b. buildPlayerProfile(answers, signals) → PlayerProfile + contradictions[]
4. rankRackets(profile, catalog)     → RankedRacket[] com ScoreBreakdown completo
5. Se full_setup: selectStringVariant(topRacket, profile) → StringVariant real
                  computeTension(racket, variant, profile) → TensionRecommendation
6. Persiste recommendation_sessions + racket_rankings + setup_recommendations
   (com recommendation_engine_version + dataset_version)
7. GET /api/recommendations/[id]     → serializa POR ENTITLEMENT
```

Passos 4–5 são **funções puras**. Recebem catálogo por parâmetro. É por isso que o simulador do admin e
os testes de persona usam exatamente o mesmo código que produção — sem mocks, sem caminho alternativo.

---

## 5. Camada de IA — contrato de isolamento

```ts
interface FreeTextExtractor {
  extract(text: string, ctx: ExtractionContext): Promise<ProfileSignal[]>;
}
interface ExplanationWriter {
  write(facts: FactSheet, tone: Tone): Promise<string>;
}
```

Regras aplicadas em código:

1. A IA **nunca** recebe o catálogo. Ela não pode escolher um produto que não foi escolhido.
2. A IA **nunca** retorna números para o domínio. `ProfileSignal.value` é enum ou booleano; nunca uma
   especificação técnica.
3. Toda saída passa por Zod. Falha de schema → descartado, log, segue sem o sinal.
4. Explicações passam por `guardFactualClaims()` (R-03). Falha → fallback determinístico.
5. Timeout de 8 s e `maxRetries: 1`. Nenhuma chamada de IA está no caminho crítico do ranking.

---

## 6. Pagamentos — abstração

```ts
interface PaymentProvider {
  readonly id: string;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  parseWebhook(req: Request): Promise<PaymentEvent | null>;   // valida assinatura
  getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus>;
}
```

Adapters: `mercadopago` (PIX + cartão, padrão BR), `stripe` (cartão internacional, futuro),
`fake` (dev/testes). Nenhuma regra de negócio conhece o gateway. O entitlement é concedido **somente**
em `payment.status = 'paid'` confirmado pelo webhook ou por reconciliação ativa — nunca no retorno do
browser.

Idempotência: `payment_events(provider, provider_event_id)` com índice único; o handler faz
`INSERT … ON CONFLICT DO NOTHING` e só processa se inseriu.

---

## 7. Versionamento (§61)

```ts
export const RECOMMENDATION_ENGINE_VERSION = '1.0.0';  // muda a cada alteração de peso/fórmula
export const DATASET_VERSION = '2026.08.0';            // muda a cada revisão do catálogo
```

Ambos gravados em toda `recommendation_sessions`. Isso permite reprocessar historicamente, comparar
versões no simulador e responder "por que a recomendação mudou?".

---

## 8. Performance

- Catálogo (~50 raquetes) é carregado uma vez e mantido em memória por processo; o ranking completo é
  O(n) sobre 50 itens — sub-milissegundo. Não há necessidade de índice vetorial ou cache distribuído.
- A tela de processamento (§63) exibe etapas reais conforme concluídas via streaming; a duração mínima é
  de 2,8 s apenas para legibilidade das mensagens, e o texto nunca mente sobre o que está sendo feito.
