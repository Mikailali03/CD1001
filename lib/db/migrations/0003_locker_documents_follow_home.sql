ALTER TABLE "property_transfers" ADD COLUMN "include_documents" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "locker_files" ADD COLUMN "property_id" text;--> statement-breakpoint
ALTER TABLE "locker_files" ADD CONSTRAINT "locker_files_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "locker_files_property_id_idx" ON "locker_files" USING btree ("property_id");