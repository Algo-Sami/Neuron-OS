import { getAIClient } from './gemini';

/**
 * Generates a 1536-dimensional vector embedding for a single text.
 * Uses gemini-embedding-001 configured with outputDimensionality.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const ai = getAIClient();
    const model = ai.getGenerativeModel({ model: 'gemini-embedding-001' });
    
    // We pass outputDimensionality at the root of the parameter object (cast as unknown first for TS compliance)
    const result = await model.embedContent({
      content: { role: 'user', parts: [{ text }] },
      outputDimensionality: 1536
    } as unknown as { content: { role: string; parts: { text: string }[] }; outputDimensionality: number });

    if (!result || !result.embedding || !result.embedding.values) {
      throw new Error('Invalid response received from embedding API');
    }

    return result.embedding.values;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    // Return a dummy vector of 1536 dimensions to prevent crash on errors
    return new Array(1536).fill(0);
  }
}

/**
 * Generates 1536-dimensional vector embeddings for a list of texts in batches.
 * Uses gemini-embedding-001 batchEmbedContents API for optimal performance.
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) return [];
  
  try {
    const ai = getAIClient();
    const model = ai.getGenerativeModel({ model: 'gemini-embedding-001' });
    
    const batchSize = 100; // Gemini API supports up to 100 requests per batch call
    const results: number[][] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const requests = batch.map(text => ({
        model: 'models/gemini-embedding-001',
        content: { role: 'user', parts: [{ text }] },
        outputDimensionality: 1536
      } as unknown as { model: string; content: { role: string; parts: { text: string }[] }; outputDimensionality: number }));
      
      const response = await model.batchEmbedContents({
        requests
      });
      
      if (response && response.embeddings) {
        results.push(...response.embeddings.map(e => e.values));
      } else {
        throw new Error('Batch embedding response was empty');
      }
    }
    
    return results;
  } catch (error) {
    console.error('Failed to generate batch embeddings:', error);
    // Fallback: generate sequentially for safety if batching fails
    const fallbackResults: number[][] = [];
    for (const text of texts) {
      const emb = await getEmbedding(text);
      fallbackResults.push(emb);
    }
    return fallbackResults;
  }
}
