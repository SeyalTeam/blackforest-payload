import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

const productList = [
  { name: 'JAM BUN', qty: 5 },
  { name: 'BUTTER BUN', qty: 8 },
  { name: 'WHEAT BREAD', qty: 3 },
  { name: 'MILK BREAD', qty: 15 },
  { name: 'MILK RUSK', qty: 7 },
  { name: 'BABY RUSK', qty: 3 },
  { name: 'Wine Biscuits', qty: 3 },
  { name: 'Chocolate Wine Biscuits', qty: 10 },
  { name: 'VANILLA CAKE SMALL', qty: 1 },
  { name: 'Strawberry Roll Cake Rs.30', qty: 6 },
  { name: 'Chocolate Cake Rs.30', qty: 6 },
  { name: 'Chocolate Cake RS.35', qty: 2 },
  { name: 'Butter Scotch Cake Rs.35', qty: 3 },
  { name: 'Honey cake Rs.30', qty: 10 },
  { name: 'Orange cake Rs.30', qty: 2 },
  { name: 'Pineapple cake Rs.30', qty: 5 },
  { name: 'Strawberry cake Rs.30', qty: 38 },
  { name: 'Chocolate cake', qty: 17 }, // Ambiguous?
  { name: 'Vanilla Cake Rs.10', qty: 58 },
  { name: 'WHITE FOREST', qty: 8 },
  { name: 'STRAWBERRY', qty: 4 },
  { name: 'BELGIUM CHOCLATE', qty: 2 },
  { name: 'BUTTER SCOTCH', qty: 1 },
  { name: 'CHOCO TRUFFLES', qty: 2 },
  { name: 'RAINBOW', qty: 2 },
  { name: 'RED VELVET', qty: 2 },
  { name: 'AMERICAN BROWNIE', qty: 3 },
  { name: 'CASHEW BROWNIE', qty: 2 },
  { name: 'DARK CHOCO MUDD', qty: 3 },
  { name: 'OREO', qty: 4 },
  { name: 'CHOCO MUFFIN', qty: 15 },
  { name: 'TEA CAKE', qty: 10 },
  { name: 'CUP PLUM', qty: 25 },
  { name: 'BUTTER CAKE', qty: 10 },
  { name: 'Strawberry pudding', qty: 4 },
  { name: 'DONUT', qty: 3 },
  { name: 'DREAM CAKE', qty: 4 },
  { name: 'BLACK FOREST PUDDING', qty: 1 },
  { name: 'POMEGRANATE POTS', qty: 4 },
  { name: 'OREO POTS', qty: 1 },
  { name: 'ASSORTED CHEESE CAKE', qty: 8 },
  { name: 'BLACK FOREST SIZZLING', qty: 2 },
  { name: 'WHITE FOREST CAKE MIX', qty: 2 },
  { name: 'WHITE FOREST CAKE SMALL', qty: 3 },
  { name: 'CHOCO TRUFFLE SMALL', qty: 2 },
  { name: 'RAINBOW SMALL', qty: 2 },
  { name: 'RED VELVET SMALL', qty: 1 },
  { name: 'BUTTER SCOTCH SMALL', qty: 1 },
  { name: 'Dark Chocolate', qty: 1 },
  { name: 'Milk chocolate', qty: 5 },
  { name: 'White chocolate', qty: 1 },
  { name: 'Dark Chocolate Lollipop', qty: 3 },
  { name: 'White Chocolate Lollipop', qty: 3 },
  { name: 'Roasted Cashew Chocolate', qty: 2 },
  { name: 'PISTACHIO', qty: 4 },
  { name: 'Cashew chocolate', qty: 4 },
  { name: 'Butter cookies', qty: 5 },
  { name: 'Nankhatai', qty: 2 },
  { name: 'Chocolate cookies', qty: 5 },
  { name: 'Multigrain cookies', qty: 3 },
  { name: 'Fruit cookies', qty: 5 },
  { name: 'SALTY BUTTER COOKIES', qty: 2 },
  { name: 'Ragi Cookies', qty: 2 },
  { name: 'Corn cookies', qty: 1 },
  { name: 'German Cookies', qty: 5 },
  { name: 'Salt cookies', qty: 2 },
  { name: 'Sweet Cookies', qty: 2 },
  { name: 'Delicious Mixture 150g', qty: 10 },
  { name: 'Delicious Mixture 250g', qty: 10 },
  { name: 'Ompodi', qty: 2 },
]

const run = async () => {
  const payload = await getPayload({ config })
  const branchId = '68fcfa0238714903fbd03e3c'

  // 1. Find a valid user to impersonate
  // Try to find a superadmin first, or the branch user.
  console.log('Finding valid user...')
  let user
  try {
    const users = await payload.find({
      collection: 'users',
      where: { role: { equals: 'superadmin' } },
      limit: 1,
    })
    if (users.docs.length > 0) {
      user = users.docs[0]
    } else {
      // Try finding branch user
      const branchUsers = await payload.find({
        collection: 'users',
        where: {
          and: [{ role: { equals: 'branch' } }, { branch: { equals: branchId } }],
        },
        limit: 1,
      })
      if (branchUsers.docs.length > 0) {
        user = branchUsers.docs[0]
      }
    }
  } catch (e) {
    console.error('Error finding user:', e)
  }

  if (!user) {
    console.error('Could not find a valid user (superadmin or branch user) to create the entry.')
    process.exit(1)
  }
  console.log(`Using user: ${user.email} (${user.role})`)

  // 2. Map Products
  const items = []
  const missing = []

  console.log('Mapping products...')
  for (const entry of productList) {
    const products = await payload.find({
      collection: 'products',
      where: {
        name: { equals: entry.name }, // Case sensitive check first? 'like' is case insensitive in Mongo usually but 'equals' is strict.
        // Let's try case-insensitive regex if possible or just standard equals.
        // Payload 'equals' is exact match.
        // We can try to fetch all products or just try exact match.
        // Given the names look precise, I'll try exact match first.
      },
      limit: 1,
    })

    if (products.docs.length > 0) {
      const p = products.docs[0]
      items.push({
        product: p.id,
        instock: entry.qty,
        status: 'waiting' as const,
        // dealer auto-populated by hook if exists in product
      })
    } else {
      // Try case-insensitive dictionary search?
      // Or regex?
      // Let's try regex search
      const regexProducts = await payload.find({
        collection: 'products',
        where: {
          name: { like: entry.name },
        },
        limit: 1,
      })
      if (regexProducts.docs.length > 0) {
        const p = regexProducts.docs[0]
        items.push({
          product: p.id,
          instock: entry.qty,
          status: 'waiting' as const,
        })
      } else {
        missing.push(entry.name)
        console.log(`MISSING: ${entry.name}`)
      }
    }
  }

  console.log(`Mapped ${items.length} items. Missing ${missing.length} items.`)

  if (items.length === 0) {
    console.log('No items mapped. Aborting.')
    process.exit(0)
  }

  // 3. Create Entry
  console.log('Creating Instock Entry...')
  try {
    const entry = await payload.create({
      collection: 'instock-entries',
      data: {
        branch: branchId,
        date: new Date().toISOString(),
        items,
        // company: branch.company // Hook will handle this if missing?
        // Hook: if (branch?.company) ... data.company = ...
        // So we don't strictly need to pass it if the hook works.
        // status: 'waiting' // Hook forces this
      } as any,
      user, // Pass the user to satisfy the hook
    })

    console.log('Successfully created Instock Entry:', entry.id)
    console.log('Invoice Number:', entry.invoiceNumber)
  } catch (error) {
    console.error('Failed to create Instock Entry:', error)
  }

  process.exit(0)
}

run()
