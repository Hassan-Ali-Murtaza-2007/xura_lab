import { readFile } from "node:fs/promises";

const repairFile = new URL("../../../../database/migrations/006_checkout_promotion_repair.sql", import.meta.url);

export async function repairCheckoutSchema(connection) {
  const sql = await readFile(repairFile, "utf8");
  // This fixed migration has no delimiters or semicolons inside string literals.
  const statements = sql.replace(/^\s*--.*$/gm, "").split(";").map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) {
    // PREPARE and session variables must all use the same connection.
    await connection.query(statement);
  }
}
