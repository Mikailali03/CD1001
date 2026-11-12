CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"property_id" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "retired_reason" text;--> statement-breakpoint
ALTER TABLE "service_records" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
CREATE INDEX "audit_log_property_id_idx" ON "audit_log" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
-- Assets marked "verified" by homeowners or AI flows, with no CasaService-verified record behind them.
INSERT INTO "audit_log" ("id", "action", "entity_type", "entity_id", "property_id", "details")
SELECT gen_random_uuid()::text, 'asset.status_reset', 'asset', a."id", a."property_id",
       jsonb_build_object('from', 'verified', 'to', 'unverified', 'reason', 'no verified service record')
FROM "assets" a
WHERE a."status" = 'verified'
  AND NOT EXISTS (SELECT 1 FROM "service_records" r WHERE r."asset_id" = a."id" AND r."verified");--> statement-breakpoint
UPDATE "assets" a SET "status" = 'unverified', "updated_at" = now()
WHERE a."status" = 'verified'
  AND NOT EXISTS (SELECT 1 FROM "service_records" r WHERE r."asset_id" = a."id" AND r."verified");--> statement-breakpoint
-- Homeowner-entered records that named "CasaService" as the company.
INSERT INTO "audit_log" ("id", "action", "entity_type", "entity_id", "property_id", "details")
SELECT gen_random_uuid()::text, 'service_record.company_cleared', 'service_record', r."id", a."property_id",
       jsonb_build_object('companyName', r."company_name", 'reason', 'reserved for verified CasaService work')
FROM "service_records" r JOIN "assets" a ON a."id" = r."asset_id"
WHERE NOT r."verified" AND lower(replace(r."company_name", ' ', '')) = 'casaservice';--> statement-breakpoint
UPDATE "service_records" SET "company_name" = NULL
WHERE NOT "verified" AND lower(replace("company_name", ' ', '')) = 'casaservice';
