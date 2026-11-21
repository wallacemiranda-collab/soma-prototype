export async function loadHistory(client, table, userId, dateKey) {
  const rows = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order(dateKey, { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}
