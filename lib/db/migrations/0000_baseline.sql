CREATE TYPE "public"."subscription_tier" AS ENUM('essential', 'basic', 'managed', 'concierge');--> statement-breakpoint
CREATE TYPE "public"."collaborator_status" AS ENUM('pending', 'accepted');--> statement-breakpoint
CREATE TABLE "properties" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text,
	"state" text,
	"zip_code" text,
	"year_built" integer,
	"sqft" integer,
	"bedrooms" integer,
	"bathrooms" numeric(4, 1),
	"lot_size" integer,
	"latitude" real,
	"longitude" real,
	"photo_url" text,
	"user_id" text NOT NULL,
	"owner_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"brand" text,
	"model" text,
	"serial_number" text,
	"install_date" text,
	"warranty_expiry" text,
	"replacement_cost" numeric(10, 2),
	"status" text DEFAULT 'unverified' NOT NULL,
	"notes" text,
	"photo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"retired_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "service_records" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"date" text NOT NULL,
	"technician_name" text,
	"technician_number" text,
	"company_name" text,
	"description" text NOT NULL,
	"cost" numeric(10, 2),
	"next_service_date" text,
	"receipt_url" text,
	"verified" boolean DEFAULT false NOT NULL,
	"casa_service_tech_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"interval_days" integer NOT NULL,
	"next_due_date" text NOT NULL,
	"completed_at" timestamp,
	"is_diy" boolean DEFAULT true NOT NULL,
	"estimated_cost" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guides" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"difficulty" text NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"tools_needed" text,
	"steps" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"description" text NOT NULL,
	"urgency" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"contact_phone" text,
	"technician_id" text,
	"technician_number" text,
	"technician_name" text,
	"scheduled_at" timestamp,
	"accepted_at" timestamp,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"from_user_id" text NOT NULL,
	"from_email" text NOT NULL,
	"to_email" text NOT NULL,
	"to_user_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	CONSTRAINT "property_transfers_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tier" "subscription_tier" DEFAULT 'essential' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"ai_scans_used" integer DEFAULT 0 NOT NULL,
	"ai_plans_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "property_collaborators" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"invited_email" text NOT NULL,
	"accepted_user_id" text,
	"status" "collaborator_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"role" text DEFAULT 'homeowner' NOT NULL,
	"technician_number" text,
	"phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'notification' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_triggers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"template_id" text,
	"trigger_event" text NOT NULL,
	"conditions" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locker_files" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"folder_id" text,
	"name" text NOT NULL,
	"object_path" text NOT NULL,
	"content_type" text DEFAULT 'image/jpeg' NOT NULL,
	"size" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locker_folders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"platform" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"job" text NOT NULL,
	"run_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "job_runs_job_run_key_pk" PRIMARY KEY("job","run_key")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_jobs" ADD CONSTRAINT "marketplace_jobs_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_collaborators" ADD CONSTRAINT "property_collaborators_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_triggers" ADD CONSTRAINT "email_triggers_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locker_files" ADD CONSTRAINT "locker_files_folder_id_locker_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."locker_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "properties_user_id_idx" ON "properties" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assets_property_id_idx" ON "assets" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "service_records_asset_id_idx" ON "service_records" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "maintenance_tasks_asset_id_idx" ON "maintenance_tasks" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "marketplace_jobs_asset_id_idx" ON "marketplace_jobs" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "marketplace_jobs_status_idx" ON "marketplace_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketplace_jobs_technician_id_idx" ON "marketplace_jobs" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "property_transfers_property_id_idx" ON "property_transfers" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_transfers_to_email_idx" ON "property_transfers" USING btree ("to_email");--> statement-breakpoint
CREATE INDEX "property_collaborators_property_id_idx" ON "property_collaborators" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_collaborators_invited_email_idx" ON "property_collaborators" USING btree ("invited_email");--> statement-breakpoint
CREATE INDEX "property_collaborators_accepted_user_id_idx" ON "property_collaborators" USING btree ("accepted_user_id");--> statement-breakpoint
CREATE INDEX "locker_files_user_id_idx" ON "locker_files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "locker_files_object_path_idx" ON "locker_files" USING btree ("object_path");--> statement-breakpoint
CREATE INDEX "locker_folders_user_id_idx" ON "locker_folders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens" USING btree ("user_id");