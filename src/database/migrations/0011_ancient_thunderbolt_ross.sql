CREATE TABLE "satisfaction_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"token" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"usou" text,
	"efeito" text,
	"impedimento" text,
	"impedimento_outro" text,
	"nota_laudo" smallint,
	"sugestao" text,
	"pode_contatar" boolean,
	"dias_depois_da_compra" integer NOT NULL,
	CONSTRAINT "satisfaction_surveys_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "satisfaction_surveys_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "satisfaction_surveys" ADD CONSTRAINT "satisfaction_surveys_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;