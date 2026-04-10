const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

const DATABASE_URL = 'postgresql://style_assistant_db_user:oan9uP7e4xyiCzu4BWbQa9Cj6gVIQrsv@dpg-d6rk7qchg0os73emutc0-a.ohio-postgres.render.com/style_assistant_db'

const dirs = ['training/closet', 'training/outfits']
dirs.forEach(d => fs.mkdirSync(d, { recursive: true }))

function downloadUrl(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close(); try { fs.unlinkSync(dest) } catch {}
        return downloadUrl(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        file.close(); try { fs.unlinkSync(dest) } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    })
    req.on('error', err => { try { fs.unlinkSync(dest) } catch {}; reject(err) })
  })
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected\n')

  // ── CLOSET SKETCHES ──────────────────────────────────────────
  console.log('Fetching closet sketches...')
  const closetRows = await client.query(`
    SELECT id, title, category, "sketchImageUrl", "sketchMimeType"
    FROM "ClosetItem"
    WHERE "sketchStatus" = 'ready'
      AND "sketchImageUrl" IS NOT NULL
    ORDER BY "savedAt" DESC
  `)
  console.log(`Found ${closetRows.rows.length} closet sketches\n`)

  let closetSaved = 0, closetFailed = 0
  for (const row of closetRows.rows) {
    const ext = (row.sketchMimeType || 'image/jpeg') === 'image/jpeg' ? 'jpg' : 'png'
    const safeName = (row.title || row.id).replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 40)
    const filename = `training/closet/${safeName}_${row.id.slice(-8)}.${ext}`
    try {
      await downloadUrl(row.sketchImageUrl, filename)
      console.log(`  ✓ ${path.basename(filename)}`)
      closetSaved++
    } catch (err) {
      console.log(`  ✗ ${row.id.slice(-8)} — ${err.message}`)
      closetFailed++
    }
  }

  // ── OUTFIT SKETCHES ──────────────────────────────────────────
  console.log('\nFetching outfit sketches...')
  const outfitRows = await client.query(`
    SELECT id, tier, title, "sketchImageUrl", "sketchMimeType"
    FROM "TierResult"
    WHERE "sketchStatus" = 'ready'
      AND "sketchImageUrl" IS NOT NULL
    ORDER BY "createdAt" DESC
  `)
  console.log(`Found ${outfitRows.rows.length} outfit sketches\n`)

  let outfitSaved = 0, outfitFailed = 0
  for (const row of outfitRows.rows) {
    const ext = (row.sketchMimeType || 'image/jpeg') === 'image/jpeg' ? 'jpg' : 'png'
    const safeName = (row.title || row.tier || row.id).replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 40)
    const filename = `training/outfits/${row.tier}_${safeName}_${row.id.slice(-8)}.${ext}`
    try {
      await downloadUrl(row.sketchImageUrl, filename)
      console.log(`  ✓ ${path.basename(filename)}`)
      outfitSaved++
    } catch (err) {
      console.log(`  ✗ ${row.id.slice(-8)} — ${err.message}`)
      outfitFailed++
    }
  }

  await client.end()

  console.log('\n══════════════════════════════════')
  console.log(`Closet:  ${closetSaved} saved, ${closetFailed} failed`)
  console.log(`Outfits: ${outfitSaved} saved, ${outfitFailed} failed`)
  console.log('══════════════════════════════════')
}

run().catch(console.error)
