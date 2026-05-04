ALTER TABLE "NormativeChunk" ADD COLUMN IF NOT EXISTS agent TEXT NOT NULL DEFAULT 'general';
CREATE INDEX IF NOT EXISTS normative_chunk_agent_idx ON "NormativeChunk"(agent);
