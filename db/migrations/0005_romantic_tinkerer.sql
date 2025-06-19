ALTER TYPE "document_status" ADD VALUE 'finding_sources';--> statement-breakpoint
ALTER TYPE "document_status" ADD VALUE 'writing_introduction';--> statement-breakpoint
ALTER TYPE "document_status" ADD VALUE 'writing_body';--> statement-breakpoint
ALTER TYPE "document_status" ADD VALUE 'writing_conclusion';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clarity_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"document_id" uuid,
	"text_hash" text NOT NULL,
	"score" integer NOT NULL,
	"explanation" text NOT NULL,
	"highlights" jsonb DEFAULT '[]'::jsonb,
	"text_excerpt" text NOT NULL,
	"character_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clarity_scores" ADD CONSTRAINT "clarity_scores_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
