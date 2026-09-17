CREATE TABLE "daily_ad_spend" (
	"dia" date PRIMARY KEY NOT NULL,
	"centavos" integer NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
