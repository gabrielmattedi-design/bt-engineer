CREATE TABLE "visitor_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_hash" text NOT NULL,
	"source" text NOT NULL,
	"medium" text,
	"campaign" text,
	"content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitor_campaigns_visitor_key" UNIQUE("visitor_hash")
);
--> statement-breakpoint
CREATE INDEX "visitor_campaigns_source_idx" ON "visitor_campaigns" USING btree ("source","created_at");