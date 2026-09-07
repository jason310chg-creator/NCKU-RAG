-- Preserve Phase 1 IDs, roles, ownership and all content tables. Existing users
-- remain disabled until explicitly provisioned for the Google email whitelist.
-- Canonical-email collisions abort this entire migration through the existing
-- unique index; operators must resolve the identities explicitly before retrying.
BEGIN;

-- Match JavaScript trim() explicitly, independent of PostgreSQL locale. POSIX
-- [[:space:]] in the C locale omits NBSP/BOM and other ECMAScript whitespace.
UPDATE "users"
SET "email" = lower(btrim("email",
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'));

ALTER TABLE "users"
    ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "image" TEXT,
    ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT false,
    ADD CONSTRAINT "users_email_canonical_check" CHECK (
        "email" = lower("email") AND
        "email" = translate("email",
            U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF', '') AND
        "email" ~ '^[^@]+@[^@]+$'
    );

CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verifications" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounts_provider_id_account_id_key" ON "accounts"("provider_id", "account_id");
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");
CREATE INDEX "verifications_expires_at_idx" ON "verifications"("expires_at");

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
