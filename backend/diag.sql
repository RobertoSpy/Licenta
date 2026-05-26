SELECT 
  agent,
  source,
  COUNT(*) as chunks,
  COUNT(embedding) as with_embeddings,
  AVG(LENGTH(content)) as avg_content_length
FROM "NormativeChunk"
GROUP BY agent, source
ORDER BY agent, source;

SELECT 
  agent,
  COUNT(*) as total,
  COUNT(embedding) as cu_embedding,
  COUNT(*) - COUNT(embedding) as fara_embedding
FROM "NormativeChunk"
GROUP BY agent;

SELECT DISTINCT agent FROM "NormativeChunk" LIMIT 20;
