-- CreateTable
CREATE TABLE "jev_connections" (
    "pool" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "keyCipher" BYTEA NOT NULL,
    "keyLast4" TEXT NOT NULL,
    "checkedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jev_connections_pkey" PRIMARY KEY ("pool")
);
