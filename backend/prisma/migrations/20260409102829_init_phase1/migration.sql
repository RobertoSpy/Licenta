-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "polygonGeoJSON" JSONB,
    "county" TEXT,
    "locality" TEXT,
    "seismicZone" TEXT,
    "frostDepthCm" INTEGER,
    "plotAreaSqm" DOUBLE PRECISION,
    "soilType" TEXT,
    "slopePercent" DOUBLE PRECISION,
    "streetOrientation" TEXT,
    "soilNotes" TEXT,
    "maxAllowedFloors" INTEGER,
    "minFoundationDepthCm" INTEGER,
    "zoningRestrictions" TEXT,
    "houseStyle" TEXT,
    "hasBasement" BOOLEAN NOT NULL DEFAULT false,
    "hasGroundFloor" BOOLEAN NOT NULL DEFAULT true,
    "upperFloorsCount" INTEGER NOT NULL DEFAULT 0,
    "hasMansard" BOOLEAN NOT NULL DEFAULT false,
    "totalFloors" INTEGER,
    "wizardStep" INTEGER NOT NULL DEFAULT 1,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "storeUrl" TEXT,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBOM" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ProjectBOM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormativeChunk" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "chapter" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768),

    CONSTRAINT "NormativeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "NormativeChunk_source_idx" ON "NormativeChunk"("source");

-- Create index for pgvector similarity search
CREATE INDEX IF NOT EXISTS "NormativeChunk_embedding_idx" ON "NormativeChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBOM" ADD CONSTRAINT "ProjectBOM_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBOM" ADD CONSTRAINT "ProjectBOM_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

