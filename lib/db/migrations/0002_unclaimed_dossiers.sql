CREATE TABLE "ownership_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"dossier_property_id" text,
	"target_property_id" text NOT NULL,
	"claimant_user_id" text NOT NULL,
	"document_type" text NOT NULL,
	"document_path" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "released_at" timestamp;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "normalized_address" text;--> statement-breakpoint
ALTER TABLE "ownership_claims" ADD CONSTRAINT "ownership_claims_dossier_property_id_properties_id_fk" FOREIGN KEY ("dossier_property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_claims" ADD CONSTRAINT "ownership_claims_target_property_id_properties_id_fk" FOREIGN KEY ("target_property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ownership_claims_status_idx" ON "ownership_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ownership_claims_dossier_idx" ON "ownership_claims" USING btree ("dossier_property_id");--> statement-breakpoint
CREATE INDEX "ownership_claims_document_path_idx" ON "ownership_claims" USING btree ("document_path");--> statement-breakpoint
CREATE INDEX "properties_normalized_address_idx" ON "properties" USING btree ("normalized_address");