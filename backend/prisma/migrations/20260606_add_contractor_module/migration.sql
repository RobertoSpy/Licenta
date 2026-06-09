-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'CONTRACTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'NEGOTIATING');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'CLIENT';

-- CreateTable
CREATE TABLE "ContractorProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyName" TEXT NOT NULL,
    "cui" TEXT,
    "description" TEXT,
    "specializations" TEXT[],
    "county" TEXT NOT NULL,
    "coverageRadius" INTEGER NOT NULL DEFAULT 50,
    "yearsExperience" INTEGER,
    "completedProjects" INTEGER NOT NULL DEFAULT 0,
    "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "portfolioUrls" TEXT[],
    "certifications" TEXT[],
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorQuote" (
    "id" SERIAL NOT NULL,
    "contractorId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DOUBLE PRECISION,
    "executionDays" INTEGER,
    "message" TEXT,
    "acceptsBOM" BOOLEAN NOT NULL DEFAULT false,
    "bomVariations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorReview" (
    "id" SERIAL NOT NULL,
    "contractorId" INTEGER NOT NULL,
    "reviewerId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractorProfile_userId_key" ON "ContractorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorQuote_contractorId_projectId_key" ON "ContractorQuote"("contractorId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorReview_contractorId_reviewerId_projectId_key" ON "ContractorReview"("contractorId", "reviewerId", "projectId");

-- AddForeignKey
ALTER TABLE "ContractorProfile" ADD CONSTRAINT "ContractorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorQuote" ADD CONSTRAINT "ContractorQuote_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "ContractorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorQuote" ADD CONSTRAINT "ContractorQuote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorReview" ADD CONSTRAINT "ContractorReview_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "ContractorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorReview" ADD CONSTRAINT "ContractorReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
