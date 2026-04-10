const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://style_assistant_db_user:oan9uP7e4xyiCzu4BWbQa9Cj6gVIQrsv@dpg-d6rk7qchg0os73emutc0-a.ohio-postgres.render.com/style_assistant_db',
  ssl: { rejectUnauthorized: false }
})

async function explore() {
  await client.connect()

  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `)
  console.log('=== TABLES ===')
  tables.rows.forEach(r => console.log(' ', r.table_name))
  console.log()

  for (const { table_name } of tables.rows) {
    const cols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table_name])
    console.log(`--- ${table_name} ---`)
    cols.rows.forEach(r => console.log(`  ${r.column_name.padEnd(35)} ${r.data_type}`))
    console.log()
  }

  console.log('=== IMAGE URL CANDIDATES ===')
  const imgs = await client.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        column_name ILIKE '%url%' OR column_name ILIKE '%image%' OR
        column_name ILIKE '%sketch%' OR column_name ILIKE '%photo%' OR
        column_name ILIKE '%img%' OR column_name ILIKE '%storage%' OR
        column_name ILIKE '%file%' OR column_name ILIKE '%src%'
      )
    ORDER BY table_name, column_name
  `)
  imgs.rows.forEach(r => console.log(`  ${r.table_name}.${r.column_name} (${r.data_type})`))

  await client.end()
}

explore().catch(console.error)
