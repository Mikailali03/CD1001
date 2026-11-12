CREATE TABLE "notification_log" (
	"key" text NOT NULL,
	"channel" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_log_key_channel_pk" PRIMARY KEY("key","channel")
);
--> statement-breakpoint
CREATE TABLE "report_sends" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"sender_user_id" text NOT NULL,
	"recipients" jsonb NOT NULL,
	"include_costs" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "property_collaborators" ADD COLUMN "receive_reminders" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "email_reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "push_reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "weekly_summary" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "unsubscribe_token" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "report_sends" ADD CONSTRAINT "report_sends_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_sends_property_id_idx" ON "report_sends" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "report_sends_sender_idx" ON "report_sends" USING btree ("sender_user_id","created_at");--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_unsubscribe_token_unique" UNIQUE("unsubscribe_token");