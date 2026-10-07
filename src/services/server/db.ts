import { Pool, type PoolClient } from "pg";
export const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
export async function inTransaction<T>(action: (db: PoolClient) => Promise<T>) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await action(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally { db.release(); }
}
