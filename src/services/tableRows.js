// Fetch every batch so table pagination can reach records beyond the API row limit.
export async function loadAllTableRows(query, keyColumns = ["id"]) {
  for (const column of keyColumns) query = query.order(column);
  const rows = [];
  const batchSize = 500;
  for (let offset = 0; ; offset += batchSize) {
    const result = await query.range(offset, offset + batchSize - 1);
    if (result.error) return result;
    rows.push(...(result.data || []));
    if (!result.data || result.data.length < batchSize) return { ...result, data: rows };
  }
}
