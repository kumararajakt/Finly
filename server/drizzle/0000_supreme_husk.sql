CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"monthly_limit" real NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"target_amount" real NOT NULL,
	"current_amount" real DEFAULT 0 NOT NULL,
	"due_date" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"amount" real NOT NULL,
	"cadence" text NOT NULL,
	"next_date" text NOT NULL,
	"account" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_cadence_check" CHECK ("recurring"."cadence" in ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual'))
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"when_text" text NOT NULL,
	"then_text" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"amount" real NOT NULL,
	"cadence" text NOT NULL,
	"next_renewal" text NOT NULL,
	"account" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_cadence_check" CHECK ("subscriptions"."cadence" in ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual'))
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"name" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"merchant" text NOT NULL,
	"category" text DEFAULT 'Needs review' NOT NULL,
	"amount" real NOT NULL,
	"type" text NOT NULL,
	"account" text DEFAULT 'Imported account' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"receipt" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_type_check" CHECK ("transactions"."type" in ('expense', 'income'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_name_unique" ON "accounts" USING btree (lower(trim("name")));--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_unique" ON "categories" USING btree (lower(trim("name")));--> statement-breakpoint
CREATE INDEX "recurring_name_idx" ON "recurring" USING btree ("name");--> statement-breakpoint
CREATE INDEX "subscriptions_name_idx" ON "subscriptions" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_fingerprint_unique" ON "transactions" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "transactions_category_idx" ON "transactions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "transactions_account_idx" ON "transactions" USING btree ("account");--> statement-breakpoint
CREATE INDEX "transactions_type_idx" ON "transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "transactions_tags_idx" ON "transactions" USING gin ("tags");