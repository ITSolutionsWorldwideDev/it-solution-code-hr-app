// lib/db.ts
import { Pool, QueryResult, QueryResultRow } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;

// Reusable helper for parameterized queries
// ✅ Make the function generic
export async function runQuery<T extends QueryResultRow = any>(
  query: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  try {
    const result = await client.query<T>(query, params);
    return result;
  } catch (error) {
    console.error("DB Query Error:", error);
    throw error;
  } finally {
    client.release();
  }
}