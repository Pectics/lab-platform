CREATE TYPE "public"."audit_actor_type" AS ENUM('administrator', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."credential_mode" AS ENUM('shared', 'per_subscriber');--> statement-breakpoint
CREATE TYPE "public"."credential_state" AS ENUM('pending', 'active', 'failed', 'revoking', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."endpoint_protocol" AS ENUM('shadowsocks_2022', 'hysteria_2');--> statement-breakpoint
CREATE TABLE "administrators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_user_id" bigint NOT NULL,
	"github_login" varchar(255),
	"display_name" varchar(255),
	"avatar_url" text,
	"last_login_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "administrators_github_user_id_positive" CHECK ("administrators"."github_user_id" > 0)
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"secret_digest" varchar(64) NOT NULL,
	"secret_prefix" varchar(24) NOT NULL,
	"capabilities" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"desired_generation" bigint DEFAULT 0 NOT NULL,
	"applied_generation" bigint DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp (3) with time zone,
	"last_healthy_at" timestamp (3) with time zone,
	"last_error_code" varchar(120),
	"rotated_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_name_not_blank" CHECK (length(trim("agents"."name")) > 0),
	CONSTRAINT "agents_digest_hex" CHECK ("agents"."secret_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "agents_prefix_not_blank" CHECK (length(trim("agents"."secret_prefix")) > 0),
	CONSTRAINT "agents_capabilities_valid" CHECK ("agents"."capabilities" <@ ARRAY['reconcile', 'probe']::text[]),
	CONSTRAINT "agents_desired_generation_nonnegative" CHECK ("agents"."desired_generation" >= 0),
	CONSTRAINT "agents_applied_generation_nonnegative" CHECK ("agents"."applied_generation" >= 0),
	CONSTRAINT "agents_applied_generation_not_ahead" CHECK ("agents"."applied_generation" <= "agents"."desired_generation")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_id" varchar(120),
	"action" varchar(120) NOT NULL,
	"resource_type" varchar(120) NOT NULL,
	"resource_id" varchar(120) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_action_not_blank" CHECK (length(trim("audit_events"."action")) > 0),
	CONSTRAINT "audit_events_resource_type_not_blank" CHECK (length(trim("audit_events"."resource_type")) > 0),
	CONSTRAINT "audit_events_resource_id_not_blank" CHECK (length(trim("audit_events"."resource_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "chain_hops" (
	"chain_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"server_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chain_hops_pk" PRIMARY KEY("chain_id","position"),
	CONSTRAINT "chain_hops_position_nonnegative" CHECK ("chain_hops"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "chains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"generation" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chains_name_not_blank" CHECK (length(trim("chains"."name")) > 0),
	CONSTRAINT "chains_generation_nonnegative" CHECK ("chains"."generation" >= 0)
);
--> statement-breakpoint
CREATE TABLE "endpoint_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"access_identity_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"state" "credential_state" DEFAULT 'pending' NOT NULL,
	"ciphertext" text NOT NULL,
	"nonce" text NOT NULL,
	"key_version" integer NOT NULL,
	"failure_code" varchar(120),
	"applied_at" timestamp (3) with time zone,
	"revoked_at" timestamp (3) with time zone,
	"generation" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "endpoint_credentials_revision_positive" CHECK ("endpoint_credentials"."revision" > 0),
	CONSTRAINT "endpoint_credentials_ciphertext_not_blank" CHECK (length("endpoint_credentials"."ciphertext") > 0),
	CONSTRAINT "endpoint_credentials_nonce_not_blank" CHECK (length("endpoint_credentials"."nonce") > 0),
	CONSTRAINT "endpoint_credentials_key_version_positive" CHECK ("endpoint_credentials"."key_version" > 0),
	CONSTRAINT "endpoint_credentials_generation_nonnegative" CHECK ("endpoint_credentials"."generation" >= 0)
);
--> statement-breakpoint
CREATE TABLE "endpoint_shared_secrets" (
	"endpoint_id" uuid PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"nonce" text NOT NULL,
	"key_version" integer NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "endpoint_shared_secrets_ciphertext_not_blank" CHECK (length("endpoint_shared_secrets"."ciphertext") > 0),
	CONSTRAINT "endpoint_shared_secrets_nonce_not_blank" CHECK (length("endpoint_shared_secrets"."nonce") > 0),
	CONSTRAINT "endpoint_shared_secrets_key_version_positive" CHECK ("endpoint_shared_secrets"."key_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"protocol" "endpoint_protocol" NOT NULL,
	"credential_mode" "credential_mode" NOT NULL,
	"address" varchar(255) NOT NULL,
	"port" integer NOT NULL,
	"public_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"generation" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "endpoints_id_server_uq" UNIQUE("id","server_id"),
	CONSTRAINT "endpoints_name_not_blank" CHECK (length(trim("endpoints"."name")) > 0),
	CONSTRAINT "endpoints_address_not_blank" CHECK (length(trim("endpoints"."address")) > 0),
	CONSTRAINT "endpoints_port_valid" CHECK ("endpoints"."port" between 1 and 65535),
	CONSTRAINT "endpoints_sort_order_nonnegative" CHECK ("endpoints"."sort_order" >= 0),
	CONSTRAINT "endpoints_generation_nonnegative" CHECK ("endpoints"."generation" >= 0)
);
--> statement-breakpoint
CREATE TABLE "profile_endpoints" (
	"profile_id" uuid NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_endpoints_pk" PRIMARY KEY("profile_id","endpoint_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"generation" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_name_not_blank" CHECK (length(trim("profiles"."name")) > 0),
	CONSTRAINT "profiles_generation_nonnegative" CHECK ("profiles"."generation" >= 0)
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"provider" varchar(120),
	"region" varchar(120),
	"host" varchar(255) NOT NULL,
	"notes" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"generation" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "servers_name_not_blank" CHECK (length(trim("servers"."name")) > 0),
	CONSTRAINT "servers_host_not_blank" CHECK (length(trim("servers"."host")) > 0),
	CONSTRAINT "servers_generation_nonnegative" CHECK ("servers"."generation" >= 0)
);
--> statement-breakpoint
CREATE TABLE "subscription_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"secret_digest" varchar(64) NOT NULL,
	"secret_prefix" varchar(24) NOT NULL,
	"remark" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"expires_at" timestamp (3) with time zone,
	"rotated_at" timestamp (3) with time zone,
	"last_used_at" timestamp (3) with time zone,
	"generation" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_tokens_digest_hex" CHECK ("subscription_tokens"."secret_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "subscription_tokens_prefix_not_blank" CHECK (length(trim("subscription_tokens"."secret_prefix")) > 0),
	CONSTRAINT "subscription_tokens_generation_nonnegative" CHECK ("subscription_tokens"."generation" >= 0)
);
--> statement-breakpoint
CREATE TABLE "token_server_access_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_token_id" uuid NOT NULL,
	"server_id" uuid NOT NULL,
	"generation" bigint DEFAULT 0 NOT NULL,
	"revoked_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "token_server_access_identity_id_server_uq" UNIQUE("id","server_id"),
	CONSTRAINT "token_server_access_identity_generation_nonnegative" CHECK ("token_server_access_identities"."generation" >= 0)
);
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chain_hops" ADD CONSTRAINT "chain_hops_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chain_hops" ADD CONSTRAINT "chain_hops_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "endpoint_credentials" ADD CONSTRAINT "endpoint_credentials_endpoint_server_fk" FOREIGN KEY ("endpoint_id","server_id") REFERENCES "public"."endpoints"("id","server_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "endpoint_credentials" ADD CONSTRAINT "endpoint_credentials_identity_server_fk" FOREIGN KEY ("access_identity_id","server_id") REFERENCES "public"."token_server_access_identities"("id","server_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "endpoint_shared_secrets" ADD CONSTRAINT "endpoint_shared_secrets_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "profile_endpoints" ADD CONSTRAINT "profile_endpoints_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "profile_endpoints" ADD CONSTRAINT "profile_endpoints_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "subscription_tokens" ADD CONSTRAINT "subscription_tokens_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "token_server_access_identities" ADD CONSTRAINT "token_server_access_identities_subscription_token_id_subscription_tokens_id_fk" FOREIGN KEY ("subscription_token_id") REFERENCES "public"."subscription_tokens"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "token_server_access_identities" ADD CONSTRAINT "token_server_access_identities_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "administrators_github_user_id_uq" ON "administrators" USING btree ("github_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_server_uq" ON "agents" USING btree ("server_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_digest_uq" ON "agents" USING btree ("secret_digest");--> statement-breakpoint
CREATE INDEX "agents_prefix_idx" ON "agents" USING btree ("secret_prefix");--> statement-breakpoint
CREATE INDEX "audit_events_resource_idx" ON "audit_events" USING btree ("resource_type","resource_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_type","actor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chain_hops_chain_server_uq" ON "chain_hops" USING btree ("chain_id","server_id");--> statement-breakpoint
CREATE INDEX "chain_hops_server_idx" ON "chain_hops" USING btree ("server_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chains_name_uq" ON "chains" USING btree ("name");--> statement-breakpoint
CREATE INDEX "chains_active_idx" ON "chains" USING btree ("archived_at","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "endpoint_credentials_revision_uq" ON "endpoint_credentials" USING btree ("endpoint_id","access_identity_id","revision");--> statement-breakpoint
CREATE INDEX "endpoint_credentials_publication_idx" ON "endpoint_credentials" USING btree ("endpoint_id","state");--> statement-breakpoint
CREATE INDEX "endpoint_credentials_identity_idx" ON "endpoint_credentials" USING btree ("access_identity_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "endpoints_server_name_uq" ON "endpoints" USING btree ("server_id","name");--> statement-breakpoint
CREATE INDEX "endpoints_publication_idx" ON "endpoints" USING btree ("server_id","archived_at","enabled","sort_order");--> statement-breakpoint
CREATE INDEX "profile_endpoints_endpoint_idx" ON "profile_endpoints" USING btree ("endpoint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_name_uq" ON "profiles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "profiles_active_idx" ON "profiles" USING btree ("archived_at","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "servers_name_uq" ON "servers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "servers_active_idx" ON "servers" USING btree ("archived_at","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_tokens_digest_uq" ON "subscription_tokens" USING btree ("secret_digest");--> statement-breakpoint
CREATE INDEX "subscription_tokens_prefix_idx" ON "subscription_tokens" USING btree ("secret_prefix");--> statement-breakpoint
CREATE INDEX "subscription_tokens_profile_idx" ON "subscription_tokens" USING btree ("profile_id","archived_at","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "token_server_access_identity_token_server_uq" ON "token_server_access_identities" USING btree ("subscription_token_id","server_id");