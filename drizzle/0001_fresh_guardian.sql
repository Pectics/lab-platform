CREATE TABLE "auth_accounts" (
	"user_id" uuid NOT NULL,
	"type" varchar(64) NOT NULL,
	"provider" varchar(128) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(64),
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "auth_accounts_provider_account_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"email" varchar(320),
	"email_verified" timestamp (3) with time zone,
	"image" text,
	"github_user_id" bigint
);
--> statement-breakpoint
CREATE TABLE "auth_verification_tokens" (
	"identifier" varchar(320) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "auth_verification_tokens_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "administrators" ADD COLUMN "auth_user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "auth_accounts_user_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_email_uq" ON "auth_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_github_user_id_uq" ON "auth_users" USING btree ("github_user_id");--> statement-breakpoint
ALTER TABLE "administrators" ADD CONSTRAINT "administrators_auth_user_id_auth_users_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."auth_users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "administrators_auth_user_id_uq" ON "administrators" USING btree ("auth_user_id");