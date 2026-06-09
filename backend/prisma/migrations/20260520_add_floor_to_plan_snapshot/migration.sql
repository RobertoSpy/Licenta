-- Migration: add_floor_to_plan_snapshot
-- Ensures PlanSnapshot exists and adds a 'floor' column for multi-floor 2D plans

CREATE TABLE IF NOT EXISTS "PlanSnapshot" (
		"id" SERIAL NOT NULL,
		"projectId" INTEGER NOT NULL,
		"planJSON" JSONB NOT NULL,
		"floor" TEXT NOT NULL DEFAULT 'parter',
		"version" INTEGER NOT NULL DEFAULT 1,
		"label" TEXT,
		"isPublished" BOOLEAN NOT NULL DEFAULT false,
		"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

		CONSTRAINT "PlanSnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PlanSnapshot"
	ADD CONSTRAINT "PlanSnapshot_projectId_fkey"
	FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "PlanSnapshot_projectId_idx" ON "PlanSnapshot"("projectId");
CREATE INDEX IF NOT EXISTS "PlanSnapshot_projectId_floor_idx" ON "PlanSnapshot"("projectId", "floor");
