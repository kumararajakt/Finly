ALTER TABLE "accounts" ADD COLUMN "type" text not null default 'cash';--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_type_check" CHECK ("accounts"."type" in ('cash', 'credit', 'investment'));--> statement-breakpoint
ALTER TABLE "transactions" RENAME COLUMN "account" to "from_account";--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "to_account" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "side" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_side_check" CHECK ("transactions"."side" is null or "transactions"."side" in ('buy', 'sell', 'dividend', 'interest'));--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_type_check";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_type_check" CHECK ("transactions"."type" in ('expense', 'income', 'transfer', 'investment'));--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trades" (
	"id" uuid primary key default gen_random_uuid() not null,
	"user_id" text not null,
	"account_id" uuid not null,
	"date" text not null,
	"security" text not null,
	"side" text not null,
	"units" real not null,
	"price" real not null,
	"amount" real not null,
	"fee" real not null default 0,
	"linked_transaction_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone not null default now(),
	constraint "trades_user_id_users_id_fk" foreign key ("user_id") references "users"("id") on update no action on delete cascade,
	constraint "trades_account_id_accounts_id_fk" foreign key ("account_id") references "accounts"("id") on update no action on delete no action,
	constraint "trades_linked_transaction_id_transactions_id_fk" foreign key ("linked_transaction_id") references "transactions"("id") on update no action on delete no action,
	constraint "trades_side_check" CHECK ("trades"."side" in ('buy', 'sell', 'dividend', 'interest'))
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "securities" (
	"user_id" text not null,
	"name" text not null,
	"current_price" real,
	"updated_at" timestamp with time zone not null default now(),
	constraint "securities_user_id_users_id_fk" foreign key ("user_id") references "users"("id") on update no action on delete cascade,
	constraint "securities_pkey" primary key ("user_id", "name")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotes" (
	"symbol" text not null,
	"source" text not null,
	"name" text,
	"price" real not null,
	"fetched_at" timestamp with time zone not null default now(),
	constraint "quotes_pkey" primary key ("symbol", "source")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trades_user_account_idx" ON "trades" ("user_id", "account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trades_user_security_idx" ON "trades" ("user_id", "security");
