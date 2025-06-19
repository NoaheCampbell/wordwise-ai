DO $$ BEGIN
 CREATE TYPE "public"."document_status" AS ENUM('generating', 'complete', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DROP TABLE "social_snippets";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "status" "document_status" DEFAULT 'complete' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "analysis" jsonb;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "enhanced_analysis" jsonb;