import type { PostgrestResponse } from "@supabase/supabase-js";

interface PagedQuery<T> {
  order(column: string): PagedQuery<T>;
  range(from: number, to: number): PromiseLike<PostgrestResponse<T>>;
}

// Fetch every batch so table pagination can reach records beyond the API row limit.
export async function loadAllTableRows<T>(query: PagedQuery<T>, keyColumns = ["id"]) {
  for (const column of keyColumns) query = query.order(column);
  const rows: T[] = [];
  const batchSize = 500;
  for (let offset = 0; ; offset += batchSize) {
    const result = await query.range(offset, offset + batchSize - 1);
    if (result.error) return result;
    rows.push(...(result.data || []));
    if (!result.data || result.data.length < batchSize) return { ...result, data: rows };
  }
}
