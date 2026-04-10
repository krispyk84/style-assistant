const { fal } = require('@fal-ai/client')
const fs = require('fs')

fal.config({
  credentials: '93c2b05d-e85c-4d9a-a65e-b0b579098120:a90e52db3c108360724fb70f18138939'
})

async function trainLora(label, zipPath, triggerWord) {
  console.log(`\n── ${label} ──────────────────────────`)

  console.log(`Uploading ${zipPath}...`)
  const fileBuffer = fs.readFileSync(zipPath)
  const blob = new Blob([fileBuffer], { type: 'application/zip' })
  const imageUrl = await fal.storage.upload(blob, {
    filename: zipPath.split('/').pop()
  })
  console.log(`Uploaded → ${imageUrl}`)

  console.log(`Submitting training job...`)
  const result = await fal.subscribe('fal-ai/flux-lora-fast-training', {
    input: {
      images_data_url: imageUrl,
      trigger_word: triggerWord,
      steps: 1000,
      learning_rate: 0.0004,
      lora_rank: 16,
      create_masks: true,
      caption_dropout_rate: 0.1,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === 'IN_PROGRESS' && update.logs?.length) {
        update.logs.forEach(l => console.log('  ', l.message))
      } else {
        console.log(`  Status: ${update.status}`)
      }
    }
  })

  const loraUrl = result.data?.diffusers_lora_file?.url
  console.log(`\n✓ ${label} done!`)
  console.log(`  LoRA URL: ${loraUrl}`)
  return loraUrl
}

async function main() {
  const closetLora = await trainLora('Closet Items', 'training/closet.zip', 'VESTURE_ITEM')
  const outfitLora = await trainLora('Outfit Illustrations', 'training/outfits.zip', 'VESTURE_OUTFIT')

  const output = `CLOSET_LORA_URL=${closetLora}\nOUTFIT_LORA_URL=${outfitLora}\n`
  fs.writeFileSync('lora_urls.txt', output)

  console.log('\n══════════════════════════════════')
  console.log(output)
  console.log('Saved to lora_urls.txt')
  console.log('══════════════════════════════════')
}

main().catch(console.error)
