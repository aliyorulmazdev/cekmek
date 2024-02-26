-- CreateTable
CREATE TABLE "ApiKey" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "remaining" INTEGER NOT NULL DEFAULT 2500,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);
