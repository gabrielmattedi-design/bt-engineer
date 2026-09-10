CREATE TABLE "meta_conversion_context" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"consent" text NOT NULL,
	"fbc" text,
	"fbp" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recommendation_sessions" ADD COLUMN "coupon_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_percent" integer;--> statement-breakpoint
ALTER TABLE "access_coupons" ADD COLUMN "discount_percent" integer;--> statement-breakpoint
ALTER TABLE "meta_conversion_context" ADD CONSTRAINT "meta_conversion_context_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;