/**
 * DDL do banco, embutida no código.
 *
 * ─── POR QUE NÃO LEMOS OS ARQUIVOS .sql EM RUNTIME ───────────────────────────────────────────
 *
 * `migrate()` do Drizzle lê `src/database/migrations/*.sql` do disco. Isso funciona na máquina de
 * quem desenvolve e é frágil em serverless: o rastreador de arquivos do Next só inclui no bundle o
 * que enxerga em `import`, e uma pasta lida por caminho depende de configuração extra para
 * sobreviver ao deploy. Se ela falhar, o botão "Criar tabelas" quebra na Vercel — e é exatamente
 * o botão que destrava o produto inteiro para um dono não-técnico.
 *
 * Aqui a DDL é código: vai para o bundle porque É o bundle.
 *
 * ─── IDEMPOTÊNCIA ────────────────────────────────────────────────────────────────────────────
 *
 * Todo comando usa `IF NOT EXISTS`, e as constraints vão dentro de um `DO $$` que checa
 * `pg_constraint`. Clicar duas vezes no botão, ou rodar sobre um banco parcialmente criado, é
 * inofensivo. Sem isso, um clique repetido devolveria "relation already exists" — um erro que
 * assusta e não significa nada.
 *
 * GERADO a partir de `src/database/migrations/`. Ao criar uma migração nova, regenere com
 * `npm run db:bootstrap-sql`.
 */

export const BOOTSTRAP_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "anonymous_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cookie_token_hash" text NOT NULL,
	"user_agent_family" text,
	"locale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anonymous_sessions_cookie_token_hash_unique" UNIQUE("cookie_token_hash")
)`,
  `CREATE TABLE IF NOT EXISTS "player_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"profile" jsonb NOT NULL,
	"signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contradictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unknown_answer_ratio" numeric(4, 3) NOT NULL,
	"profile_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "racket_rankings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_session_id" uuid NOT NULL,
	"racket_variant_id" text NOT NULL,
	"rank" integer NOT NULL,
	"fit_score" numeric(5, 2) NOT NULL,
	"breakdown" jsonb NOT NULL,
	"penalties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excluded_by_filter" text
)`,
  `CREATE TABLE IF NOT EXISTS "recommendation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"session_id" uuid NOT NULL,
	"player_profile_id" uuid NOT NULL,
	"recommendation_engine_version" text NOT NULL,
	"dataset_version" text NOT NULL,
	"weights_version" text NOT NULL,
	"methodology_version" text NOT NULL,
	"confidence_level" text NOT NULL,
	"confidence_score" numeric(5, 2) NOT NULL,
	"confidence_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"candidates_evaluated" integer NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_sessions_public_id_unique" UNIQUE("public_id")
)`,
  `CREATE TABLE IF NOT EXISTS "entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"recommendation_session_id" uuid,
	"entitlement" text NOT NULL,
	"granted_by_order_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
)`,
  `CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"recommendation_session_id" uuid,
	"product_sku" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
)`,
  `CREATE TABLE IF NOT EXISTS "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_payment_id" text,
	"method" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"grants_entitlements" text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
)`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_profiles_session_id_anonymous_sessions_id_fk') THEN
    ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_session_id_anonymous_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."anonymous_sessions"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'racket_rankings_rec_session_fk') THEN
    ALTER TABLE "racket_rankings" ADD CONSTRAINT "racket_rankings_rec_session_fk" FOREIGN KEY ("recommendation_session_id") REFERENCES "public"."recommendation_sessions"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recommendation_sessions_session_id_anonymous_sessions_id_fk') THEN
    ALTER TABLE "recommendation_sessions" ADD CONSTRAINT "recommendation_sessions_session_id_anonymous_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."anonymous_sessions"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recommendation_sessions_player_profile_id_player_profiles_id_fk') THEN
    ALTER TABLE "recommendation_sessions" ADD CONSTRAINT "recommendation_sessions_player_profile_id_player_profiles_id_fk" FOREIGN KEY ("player_profile_id") REFERENCES "public"."player_profiles"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entitlements_session_id_anonymous_sessions_id_fk') THEN
    ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_session_id_anonymous_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."anonymous_sessions"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entitlements_granted_by_order_id_orders_id_fk') THEN
    ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_granted_by_order_id_orders_id_fk" FOREIGN KEY ("granted_by_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entitlements_rec_session_fk') THEN
    ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_rec_session_fk" FOREIGN KEY ("recommendation_session_id") REFERENCES "public"."recommendation_sessions"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_session_id_anonymous_sessions_id_fk') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_session_id_anonymous_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."anonymous_sessions"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_recommendation_session_id_recommendation_sessions_id_fk') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_recommendation_session_id_recommendation_sessions_id_fk" FOREIGN KEY ("recommendation_session_id") REFERENCES "public"."recommendation_sessions"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_order_id_orders_id_fk') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "racket_rankings_session_rank_idx" ON "racket_rankings" USING btree ("recommendation_session_id","rank")`,
  `CREATE INDEX IF NOT EXISTS "recommendation_sessions_session_idx" ON "recommendation_sessions" USING btree ("session_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "entitlements_unique_idx" ON "entitlements" USING btree ("session_id","recommendation_session_id","entitlement")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_provider_event_idx" ON "payment_events" USING btree ("provider","provider_event_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_id_idx" ON "payments" USING btree ("provider","provider_payment_id")`,
  `CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
)`,
  `CREATE TABLE IF NOT EXISTS "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "access_coupons" (
	"code" text PRIMARY KEY NOT NULL,
	"grants" text[] NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"session_id" uuid NOT NULL,
	"recommendation_session_id" uuid NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "support_lookups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_kind" text NOT NULL,
	"matched_count" integer NOT NULL,
	"recommendation_session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `ALTER TABLE "recommendation_sessions" ADD COLUMN IF NOT EXISTS "setup_variant_id" text`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "user_id" uuid`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coupon_redemptions_session_id_anonymous_sessions_id_fk') THEN
    ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_session_id_anonymous_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."anonymous_sessions"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coupon_redemptions_rec_session_fk') THEN
    ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_rec_session_fk" FOREIGN KEY ("recommendation_session_id") REFERENCES "public"."recommendation_sessions"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_lookups_rec_session_fk') THEN
    ALTER TABLE "support_lookups" ADD CONSTRAINT "support_lookups_rec_session_fk" FOREIGN KEY ("recommendation_session_id") REFERENCES "public"."recommendation_sessions"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "coupon_redemptions_unique_idx" ON "coupon_redemptions" USING btree ("code","recommendation_session_id")`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_user_id_users_id_fk') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$`,
  `CREATE TABLE IF NOT EXISTS "login_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "login_tokens_token_hash_unique" UNIQUE("token_hash")
)`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'login_tokens_user_id_users_id_fk') THEN
    ALTER TABLE "login_tokens" ADD CONSTRAINT "login_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$`,
  `CREATE INDEX IF NOT EXISTS "login_tokens_user_idx" ON "login_tokens" USING btree ("user_id","created_at")`,
  `ALTER TABLE "recommendation_sessions" ADD COLUMN IF NOT EXISTS "user_id" uuid`,
  `CREATE TABLE IF NOT EXISTS "funnel_markers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_hash" text NOT NULL,
	"marker" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funnel_markers_visitor_marker_key" UNIQUE("visitor_hash","marker")
)`,
  `CREATE INDEX IF NOT EXISTS "funnel_markers_marker_idx" ON "funnel_markers" USING btree ("marker","created_at")`,
  `CREATE TABLE IF NOT EXISTS "visitor_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_hash" text NOT NULL,
	"source" text NOT NULL,
	"medium" text,
	"campaign" text,
	"content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitor_campaigns_visitor_key" UNIQUE("visitor_hash")
)`,
  `CREATE INDEX IF NOT EXISTS "visitor_campaigns_source_idx" ON "visitor_campaigns" USING btree ("source","created_at")`,
  `CREATE TABLE IF NOT EXISTS "attempt_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "attempt_counters_scope_window_key" UNIQUE("scope","window_start")
)`,
  `CREATE INDEX IF NOT EXISTS "attempt_counters_scope_idx" ON "attempt_counters" USING btree ("scope","window_start")`,
  `ALTER TABLE "access_coupons" ADD COLUMN IF NOT EXISTS "daily_limit" integer`,
  `CREATE TABLE IF NOT EXISTS "meta_conversion_context" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"consent" text NOT NULL,
	"fbc" text,
	"fbp" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `ALTER TABLE "recommendation_sessions" ADD COLUMN IF NOT EXISTS "coupon_code" text`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "coupon_code" text`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_percent" integer`,
  `ALTER TABLE "access_coupons" ADD COLUMN IF NOT EXISTS "discount_percent" integer`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meta_conversion_context_order_id_orders_id_fk') THEN
    ALTER TABLE "meta_conversion_context" ADD CONSTRAINT "meta_conversion_context_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$`,
  `ALTER TABLE "meta_conversion_context" ADD COLUMN IF NOT EXISTS "enviado_em" timestamp with time zone`,
  `ALTER TABLE "meta_conversion_context" ADD COLUMN IF NOT EXISTS "motivo_do_envio" text`,
  `CREATE TABLE IF NOT EXISTS "daily_ad_spend" (
	"dia" date PRIMARY KEY NOT NULL,
	"centavos" integer NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
)`,
];
