-- Adaugă câmpul status pentru a indica dacă un normativ este în vigoare sau în revizuire
ALTER TABLE "NormativeChunk" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'in_vigoare';

-- Index pe status pentru filtrare rapidă (ex: afișăm doar normative în vigoare)
CREATE INDEX IF NOT EXISTS normative_chunk_status_idx ON "NormativeChunk"("status");
