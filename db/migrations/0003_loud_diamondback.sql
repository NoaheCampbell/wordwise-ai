ALTER TABLE "documents" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_slug_unique" UNIQUE("slug");