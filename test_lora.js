const { fal } = require('@fal-ai/client')
const fs = require('fs')
const https = require('https')
const http = require('http')

fal.config({
  credentials: '93c2b05d-e85c-4d9a-a65e-b0b579098120:a90e52db3c108360724fb70f18138939'
})

const CLOSET_LORA_URL = 'https://v3b.fal.media/files/b/0a95608a/6cQl2v4QmOOd-3X4pZOrq_pytorch_lora_weights.safetensors'
const OUTFIT_LORA_URL = 'https://v3b.fal.media/files/b/0a9560ca/6T9r1GYyOFAZ_H8CIw6Jj_pytorch_lora_weights.safetensors'

function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filename)
    const lib = url.startsWith('https') ? https : http
    lib.get(url, res => {
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    }).on('error', reject)
  })
}

async function testGeneration(label, loraUrl, triggerWord, prompt, outputFile) {
  console.log(`\n── Testing ${label} ──────────────────────`)
  console.log(`Prompt: ${prompt}`)
  process.stdout.write('Generating')

  const result = await fal.subscribe('fal-ai/flux-lora', {
    input: {
      prompt: `${triggerWord}, ${prompt}`,
      loras: [{ path: loraUrl, scale: 0.9 }],
      image_size: 'portrait_4_3',
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
    },
    logs: false,
    onQueueUpdate: () => process.stdout.write('.')
  })

  console.log()
  const imageUrl = result.data?.images?.[0]?.url
  if (!imageUrl) {
    console.log('✗ No image returned:', JSON.stringify(result.data))
    return
  }

  await downloadImage(imageUrl, outputFile)
  console.log(`✓ Saved → ${outputFile}`)
}

async function main() {
  fs.mkdirSync('test_output', { recursive: true })

  await testGeneration(
    'Closet Item',
    CLOSET_LORA_URL,
    'VESTURE_ITEM',
    'charcoal wool blazer, single garment, warm parchment background, fine line watercolor illustration, no body',
    'test_output/closet_test.jpg'
  )

  await testGeneration(
    'Outfit Illustration',
    OUTFIT_LORA_URL,
    'VESTURE_OUTFIT',
    'smart casual outfit on headless mannequin, navy rollneck sweater, beige pleated trousers, brown loafers, accessories beside, warm watercolor wash background',
    'test_output/outfit_test.jpg'
  )

  console.log('\n══════════════════════════════════')
  console.log('Opening results...')
  console.log('══════════════════════════════════')
}

main()
  .then(() => {
    const { execSync } = require('child_process')
    execSync('open test_output/closet_test.jpg')
    execSync('open test_output/outfit_test.jpg')
  })
  .catch(console.error)
