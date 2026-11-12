CREATE TABLE "service_waitlist" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"property_id" text,
	"email" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
ALTER TABLE "service_records" ADD COLUMN "estimated_cost" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "service_waitlist" ADD CONSTRAINT "service_waitlist_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_waitlist_user_property_idx" ON "service_waitlist" USING btree ("user_id","property_id");--> statement-breakpoint
CREATE INDEX "service_waitlist_state_idx" ON "service_waitlist" USING btree ("state");--> statement-breakpoint
CREATE INDEX "rate_limits_window_start_idx" ON "rate_limits" USING btree ("window_start");