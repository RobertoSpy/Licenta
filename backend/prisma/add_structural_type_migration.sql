-- Adaugă câmpul structuralType pe Material
-- Marchează semantic tipul materialului structural: "BCA" | "CARAMIDA" | null
-- Necesar pentru logica condițională data-driven din bomService.ts
ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "structuralType" TEXT;
