CREATE TABLE "funnel_markers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_hash" text NOT NULL,
	"marker" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funnel_markers_visitor_marker_key" UNIQUE("visitor_hash","marker")
);
--> statement-breakpoint
CREATE INDEX "funnel_markers_marker_idx" ON "funnel_markers" USING btree ("marker","created_at");