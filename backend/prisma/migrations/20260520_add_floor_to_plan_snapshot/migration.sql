-- Migration: add_floor_to_plan_snapshot
-- Adds a 'floor' column to PlanSnapshot to support multi-floor 2D plans
-- Each floor (parter, etaj1, etaj2, mansarda) has its own independent plan

ALTER TABLE "PlanSnapshot" ADD COLUMN "floor" TEXT NOT NULL DEFAULT 'parter';

-- Add index for efficient per-floor queries
CREATE INDEX IF NOT EXISTS "PlanSnapshot_projectId_floor_idx" ON "PlanSnapshot"("projectId", "floor");
