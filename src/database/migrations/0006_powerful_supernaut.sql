CREATE TABLE "attempt_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "attempt_counters_scope_window_key" UNIQUE("scope","window_start")
);
--> statement-breakpoint
CREATE INDEX "attempt_counters_scope_idx" ON "attempt_counters" USING btree ("scope","window_start");