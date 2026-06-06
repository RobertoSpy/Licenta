-- CreateTable: MarketIndexPoint
-- Date INSSE CNS107D — indici cost construcții (ian 2005 → prezent)
CREATE TABLE "MarketIndexPoint" (
    "id"         SERIAL NOT NULL,
    "year"       INTEGER NOT NULL,
    "month"      INTEGER NOT NULL,
    "category"   TEXT NOT NULL,
    "indexValue" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MarketIndexPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketIndexPoint_year_month_category_key" ON "MarketIndexPoint"("year", "month", "category");
CREATE INDEX "MarketIndexPoint_category_idx" ON "MarketIndexPoint"("category");
CREATE INDEX "MarketIndexPoint_year_idx" ON "MarketIndexPoint"("year");

-- CreateTable: MarketForecastCache
-- Cache pentru prognoza AI (regenerată lunar)
CREATE TABLE "MarketForecastCache" (
    "id"           SERIAL NOT NULL,
    "generatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forecastJson" TEXT NOT NULL,
    "modelUsed"    TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
    "isValid"      BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MarketForecastCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketForecastCache_generatedAt_idx" ON "MarketForecastCache"("generatedAt");
