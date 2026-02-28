import 'dotenv/config'
import { getPayload } from 'payload'
import configPromise from '../payload.config'

async function run() {
  const payload = await getPayload({
    config: configPromise,
  })

  const products = await payload.find({
    collection: 'products',
    where: {
      name: { in: ['EGG PUFFS', 'DUBAI CHOCO KUNAFA'] },
    },
    depth: 1,
  })

  console.log('--- URLs from Payload API ---')
  products.docs.forEach((p) => {
    console.log(`\nProduct: ${p.name}`)
    if (p.images) {
      p.images.forEach((imgObj, i) => {
        const media = imgObj.image
        if (typeof media === 'object' && media.url) {
          console.log(`  Image ${i + 1}: ${media.url}`)
        } else {
          console.log(`  Image ${i + 1}: [No URL generated, media: ${JSON.stringify(media)}]`)
        }
      })
    }
  })

  process.exit(0)
}

run()
