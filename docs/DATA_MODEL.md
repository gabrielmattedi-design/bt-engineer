# DATA_MODEL.md — Tennis Engineer

Status: `v1` · Postgres 15+ · Drizzle ORM

---

## 1. Visão geral das entidades (§45)

```
users ──┬── orders ── payments ── payment_events
        └── entitlements ──┐
anonymous_sessions ────────┴── recommendation_sessions ──┬── racket_rankings
        │                                                 ├── setup_recommendations
        ├── questionnaire_answers                         └── feedback
        └── player_profiles

rackets ── racket_variants ── racket_attributes (derivados) ── racket_images
strings ── string_variants  ── string_attributes (derivados)
data_sources ── data_revisions        products
```

Princípio: **variante é a unidade recomendável**, tanto para raquetes quanto para cordas. Nunca se
recomenda um "modelo"; recomenda-se uma variante concreta, existente e verificada.

---

## 2. Procedência — o tipo transversal

Nenhum número técnico existe solto. Cada campo relevante tem procedência própria.

```sql
CREATE TYPE source_tier AS ENUM (
  'manufacturer',        -- 1. site/catálogo oficial
  'official_distributor',-- 2. distribuidor oficial no país
  'lab',                 -- 3. medição de laboratório (RDC/Babolat RDC)
  'major_retailer',      -- 4. grande varejista especializado
  'br_retailer',         -- 5. varejista brasileiro confiável
  'technical_review',    -- 6. review técnico reconhecido
  'unverified'           -- 0. sem fonte -> NÃO utilizável comercialmente
);

CREATE TYPE confidence_level AS ENUM ('high','medium','low');

CREATE TYPE verification_state AS ENUM ('draft','pending_verification','verified','disputed');
```

Armazenamento: cada tabela de specs tem uma coluna `provenance jsonb` no formato
`{ "<campo>": { "source": …, "source_url": …, "verified_at": …, "confidence": …, "notes": … } }`.

Motivo de usar `jsonb` em vez de uma tabela por campo: são ~20 campos × ~50 produtos; uma tabela
`field_provenance` normalizada seria mais pura, mas as consultas do admin ficam 5× mais complexas sem
ganho real. A validação de forma é feita por Zod na escrita e por `CHECK` de existência de chave.

**Divergências entre fontes** (§7) vão para `data_revisions`, que preserva histórico:

```sql
CREATE TABLE data_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,          -- 'racket_variant' | 'string_variant' | ...
  entity_id uuid NOT NULL,
  field text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  source_tier source_tier NOT NULL,
  source_url text,
  divergence_note text,               -- "TW 322 / RSI 318 — adotado TW por tier"
  policy_applied text,                -- 'highest_tier_wins' | 'median_of_labs' | 'manual'
  changed_by text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 3. Raquetes

### 3.1 `rackets` — a família/modelo

```sql
CREATE TABLE rackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,               -- HEAD | Wilson | Babolat | Yonex
  family text NOT NULL,              -- 'Pure Aero', 'Speed', 'Blade', 'EZONE'
  model text NOT NULL,               -- 'Pure Aero 98'
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.2 `racket_variants` — a unidade recomendável

Uma variante = **modelo + variante de peso + geração/ano**. §5 é explícito: 305 g e 285 g não são o mesmo
produto; gerações 2023/2025/2026 não compartilham specs.

```sql
CREATE TYPE product_status AS ENUM ('current','previous_generation','discontinued');
CREATE TYPE availability_status AS ENUM ('widely_available','available','limited','not_found','unknown');

CREATE TABLE racket_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  racket_id uuid NOT NULL REFERENCES rackets(id) ON DELETE CASCADE,

  variant text NOT NULL,             -- 'Tour' | '98 305g' | 'Team' | 'L' | 'base'
  generation text NOT NULL,          -- '2023' | 'v14' | '7th gen'
  year int,
  product_name text NOT NULL,        -- nome comercial completo, exibível
  status product_status NOT NULL,

  -- specs PUBLICADAS pelo fabricante (§6) — metodologia v2
  --
  -- Não existem colunas para swingweight, stiffness_ra, twistweight nem strung_weight_g.
  -- São medições de laboratório: não são publicadas, variam por exemplar e não existem de forma
  -- consistente para as quatro marcas. Removê-las do SCHEMA (e não apenas deixá-las NULL) é o que
  -- torna estruturalmente impossível colá-las depois "só para completar o cadastro".
  head_size_sq_in numeric(5,1),
  length_in numeric(4,2),
  unstrung_weight_g numeric(5,1),
  balance_mm numeric(5,1),           -- unstrung
  balance_points numeric(4,1),       -- derivado de balance_mm e length
  beam_width_mm text,                -- '23/26/23' — texto por ser perfil variável
  string_pattern_mains int,
  string_pattern_crosses int,
  recommended_tension_min_lbs numeric(4,1),
  recommended_tension_max_lbs numeric(4,1),
  grip_sizes_available int[],        -- [1,2,3,4]

  -- governança
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_state verification_state NOT NULL DEFAULT 'draft',
  brazil_availability_status availability_status NOT NULL DEFAULT 'unknown',
  global_availability availability_status NOT NULL DEFAULT 'unknown',
  data_version text NOT NULL,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (racket_id, variant, generation),
  CHECK (head_size_sq_in IS NULL OR head_size_sq_in BETWEEN 80 AND 140),
  CHECK (unstrung_weight_g IS NULL OR unstrung_weight_g BETWEEN 200 AND 400),
  CHECK (balance_mm IS NULL OR balance_mm BETWEEN 280 AND 390),
  CHECK (recommended_tension_min_lbs IS NULL OR recommended_tension_max_lbs IS NULL
         OR recommended_tension_min_lbs <= recommended_tension_max_lbs)
);
```

Os `CHECK` existem para tornar impossível persistir um valor fisicamente absurdo — outra barreira contra
dados inventados.

### 3.3 `racket_attributes` — camada 2 (derivados)

Nunca digitados à mão. Calculados por `normalize/racket-attributes.ts` e **recomputados** a cada mudança
de spec ou de metodologia. Persistidos para auditoria e para o admin, mas a fonte de verdade é a função.

```sql
CREATE TABLE racket_attributes (
  racket_variant_id uuid PRIMARY KEY REFERENCES racket_variants(id) ON DELETE CASCADE,
  power_score numeric(5,2), control_score numeric(5,2), spin_score numeric(5,2),
  comfort_score numeric(5,2), stability_score numeric(5,2), maneuverability_score numeric(5,2),
  forgiveness_score numeric(5,2), precision_score numeric(5,2), feel_score numeric(5,2),
  launch_angle_score numeric(5,2), arm_friendliness_score numeric(5,2),
  demand_index numeric(5,2),           -- quão exigente o frame é
  data_completeness numeric(4,3) NOT NULL,   -- 0–1 (R-02)
  methodology_version text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);
```

Adequações e estilos (§6) — armazenados como scores 0–100, não booleanos, porque adequação é gradiente:

```sql
CREATE TABLE racket_fit_profiles (
  racket_variant_id uuid PRIMARY KEY REFERENCES racket_variants(id) ON DELETE CASCADE,
  beginner_fit numeric(5,2), intermediate_fit numeric(5,2),
  advanced_fit numeric(5,2), competitive_fit numeric(5,2),
  baseline numeric(5,2), aggressive_baseliner numeric(5,2), counterpuncher numeric(5,2),
  heavy_spin numeric(5,2), flat_hitter numeric(5,2), all_court numeric(5,2),
  serve_and_volley numeric(5,2), net_player numeric(5,2),
  methodology_version text NOT NULL
);
```

### 3.4 `racket_images` (§54)

```sql
CREATE TABLE racket_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  racket_variant_id uuid NOT NULL REFERENCES racket_variants(id) ON DELETE CASCADE,
  url text NOT NULL, alt text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  source text NOT NULL, license_note text,
  verified_matches_variant boolean NOT NULL DEFAULT false
);
```

A UI só exibe imagem com `verified_matches_variant = true`. Caso contrário, placeholder elegante —
**nunca** a foto de outro modelo/geração.

---

## 4. Cordas — e a regra de integridade dos gauges

### 4.1 `strings` (o modelo)

```sql
CREATE TYPE string_type AS ENUM (
  'polyester','co_polyester','multifilament','synthetic_gut','natural_gut','hybrid'
);

CREATE TABLE strings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,               -- Luxilon|Solinco|Babolat|HEAD|Yonex|Wilson
  model text NOT NULL,
  slug text NOT NULL UNIQUE,
  string_type string_type NOT NULL,
  material text,                     -- 'co-poly monofilament', 'PU multifilament'
  shape text,                        -- 'round','pentagonal','hexagonal','textured'
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 4.2 `string_variants` — **a única entidade recomendável**

> Regra de integridade: uma variante `marca+modelo+gauge` só existe na tabela se for um produto **real e
> comercialmente disponível**, confirmado por fonte. Nunca inferir gauge de outra corda da mesma família.

```sql
CREATE TABLE string_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  string_id uuid NOT NULL REFERENCES strings(id) ON DELETE CASCADE,
  gauge_mm numeric(4,2) NOT NULL,
  gauge_us text,                     -- '16','16L','17','18'
  status product_status NOT NULL DEFAULT 'current',
  market text NOT NULL DEFAULT 'BR',

  global_availability availability_status NOT NULL DEFAULT 'unknown',
  brazil_availability_status availability_status NOT NULL DEFAULT 'unknown',
  commercial_availability_note text,

  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_state verification_state NOT NULL DEFAULT 'draft',
  source_tier source_tier NOT NULL DEFAULT 'unverified',
  source_url text,
  last_verified_at timestamptz,
  data_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (string_id, gauge_mm, market),
  CHECK (gauge_mm BETWEEN 0.95 AND 1.45)
);
```

### 4.3 `string_attributes` — por variante, não por modelo

O mesmo modelo em 1.20 e 1.30 tem comportamento diferente (§8). Os scores base vêm do modelo e são
**ajustados por gauge** por função documentada (ver `RECOMMENDATION_ENGINE.md` §6).

```sql
CREATE TABLE string_attributes (
  string_variant_id uuid PRIMARY KEY REFERENCES string_variants(id) ON DELETE CASCADE,
  power_score numeric(5,2), control_score numeric(5,2), spin_score numeric(5,2),
  comfort_score numeric(5,2), stiffness_score numeric(5,2), durability_score numeric(5,2),
  tension_maintenance_score numeric(5,2), arm_friendliness_score numeric(5,2),
  recommended_player_type text[],
  data_completeness numeric(4,3) NOT NULL,
  methodology_version text NOT NULL
);
```

**Índice de filtro do motor** — nenhuma consulta de recomendação pode omitir estas condições:

```sql
CREATE INDEX idx_string_variants_recommendable
  ON string_variants (brazil_availability_status, verification_state, status)
  WHERE brazil_availability_status IN ('widely_available','available')
    AND verification_state = 'verified'
    AND status <> 'discontinued';
```

---

## 5. Sessão, perfil e recomendação

```sql
CREATE TABLE anonymous_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cookie_token_hash text NOT NULL UNIQUE,
  user_agent_family text, locale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  claimed_by_user_id uuid REFERENCES users(id)      -- vínculo opcional pós-checkout
);

CREATE TABLE questionnaire_answers (            -- append-only, auditável
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES anonymous_sessions(id) ON DELETE CASCADE,
  step text NOT NULL, question_key text NOT NULL,
  value jsonb NOT NULL, answered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE player_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES anonymous_sessions(id) ON DELETE CASCADE,
  profile jsonb NOT NULL,           -- PlayerProfile serializado
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,        -- ProfileSignal[] da IA
  contradictions jsonb NOT NULL DEFAULT '[]'::jsonb,
  unknown_answer_ratio numeric(4,3) NOT NULL,
  profile_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recommendation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,                    -- para /setup/[publicId]
  session_id uuid NOT NULL REFERENCES anonymous_sessions(id) ON DELETE CASCADE,
  player_profile_id uuid NOT NULL REFERENCES player_profiles(id),
  recommendation_engine_version text NOT NULL,       -- §61
  dataset_version text NOT NULL,
  weights_version text NOT NULL,
  confidence_level confidence_level NOT NULL,
  confidence_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  candidates_evaluated int NOT NULL,                 -- número real exibido no teaser
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE racket_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_session_id uuid NOT NULL REFERENCES recommendation_sessions(id) ON DELETE CASCADE,
  racket_variant_id uuid NOT NULL REFERENCES racket_variants(id),
  rank int NOT NULL,
  fit_score numeric(5,2) NOT NULL,
  breakdown jsonb NOT NULL,          -- ScoreBreakdown completo (§48)
  penalties jsonb NOT NULL DEFAULT '[]'::jsonb,
  excluded_by_filter text,           -- se hard-filtered
  UNIQUE (recommendation_session_id, rank)
);

CREATE TABLE setup_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_session_id uuid NOT NULL REFERENCES recommendation_sessions(id) ON DELETE CASCADE,
  component_type text NOT NULL,      -- 'string' | 'tension' | futuro: 'grip','lead_tape'
  racket_variant_id uuid REFERENCES racket_variants(id),
  string_variant_id uuid REFERENCES string_variants(id),
  tension_lbs numeric(4,1), tension_kg numeric(4,1),
  tension_min_lbs numeric(4,1), tension_max_lbs numeric(4,1),
  mains_tension_lbs numeric(4,1), crosses_tension_lbs numeric(4,1),   -- híbridos
  rationale jsonb NOT NULL
);
```

`setup_recommendations` é polimórfica por `component_type` justamente para acomodar §66 (lead tape,
grips, tênis) sem migração destrutiva.

---

## 6. Comércio

```sql
CREATE TYPE order_status AS ENUM ('pending','paid','failed','refunded','cancelled');

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,          -- racket_report | full_setup | top3_unlock
  name text NOT NULL, description text,
  price_cents int NOT NULL, currency text NOT NULL DEFAULT 'BRL',
  grants_entitlements text[] NOT NULL,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES anonymous_sessions(id),
  recommendation_session_id uuid REFERENCES recommendation_sessions(id),
  user_id uuid REFERENCES users(id),
  product_sku text NOT NULL REFERENCES products(sku),
  amount_cents int NOT NULL,         -- snapshot do preço no momento da compra
  currency text NOT NULL DEFAULT 'BRL',
  status order_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider text NOT NULL,            -- 'mercadopago' | 'stripe' | 'fake'
  provider_payment_id text,
  method text,                       -- 'pix' | 'credit_card'
  status order_status NOT NULL DEFAULT 'pending',
  amount_cents int NOT NULL,
  raw jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id)
);

CREATE TABLE payment_events (        -- idempotência do webhook (§33)
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL, payload jsonb NOT NULL,
  processed_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE entitlements (          -- §32
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES anonymous_sessions(id) ON DELETE CASCADE,
  recommendation_session_id uuid REFERENCES recommendation_sessions(id),
  entitlement text NOT NULL,         -- racket_report_access|full_setup_access|top3_access
  granted_by_order_id uuid REFERENCES orders(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (session_id, recommendation_session_id, entitlement)
);
```

Dinheiro é `int` em centavos — nunca `float`. O preço é copiado para `orders.amount_cents` no momento da
compra, para que alterações futuras em `products` não reescrevam o histórico.

---

## 7. Feedback (§38, §67)

```sql
CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_session_id uuid NOT NULL REFERENCES recommendation_sessions(id) ON DELETE CASCADE,
  made_sense int CHECK (made_sense BETWEEN 1 AND 5),
  tested boolean,
  power int CHECK (power BETWEEN 1 AND 5),
  control int CHECK (control BETWEEN 1 AND 5),
  spin int CHECK (spin BETWEEN 1 AND 5),
  comfort int CHECK (comfort BETWEEN 1 AND 5),
  stability int CHECK (stability BETWEEN 1 AND 5),
  better_than_previous boolean,
  would_keep_using boolean,
  free_text text,
  consent_to_research boolean NOT NULL DEFAULT false,   -- LGPD opt-in
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 8. LGPD (§51)

- `users` (dado pessoal) é a **única** tabela com e-mail/nome, e só é criada no checkout.
- `player_profiles` e `recommendation_sessions` referenciam a sessão anônima, não o usuário.
- `deleteSubject(sessionId)`: apaga `users`, anonimiza `orders.user_id`, mantém `feedback` e agregados
  sem qualquer vínculo identificável.
- Retenção: sessões anônimas sem compra são purgadas em 180 dias.

```sql
CREATE TABLE users (                 -- criada no checkout; a única com dado pessoal
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,        -- sempre normalizado: trim + lowercase
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_lookups (       -- auditoria de /admin/analises
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_kind text NOT NULL,          -- analise|pedido|pagamento|email — NUNCA o termo buscado
  matched_count int NOT NULL,
  recommendation_session_id uuid REFERENCES recommendation_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

`support_lookups` guarda o TIPO da busca, não o termo: registrar o e-mail consultado criaria uma
segunda tabela com dado pessoal, contra a regra acima, justamente no log feito para protegê-lo. O
`ON DELETE SET NULL` faz o registro da consulta sobreviver ao exercício do direito de exclusão — um
log apagado junto com o dado auditado não audita nada.

### Estado da implementação

| Item | Situação |
|---|---|
| `users`, `orders.user_id` | tabela e coluna **existem**; nada grava nelas ainda — o checkout não pede e-mail |
| `support_lookups` | em uso por `/admin/analises` |
| `deleteSubject(sessionId)` | **não implementado** |
| Purga de 180 dias | **não implementada** — não há rotina de expurgo no código |

As duas últimas linhas são promessas deste documento que o código ainda não cumpre. Estão anotadas
aqui, e não silenciadas, porque uma retenção prometida e não executada só vira problema no dia em
que alguém perguntar.
