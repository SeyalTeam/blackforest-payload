import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const run = async () => {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URI,
  })

  try {
    await client.connect()
    
    const check = await client.query("SELECT id FROM products WHERE name = 'Legacy/Deleted Product'")
    if (check.rows.length > 0) {
      console.log('Legacy Product already exists ID:', check.rows[0].id)
      return
    }

    const catRes = await client.query("SELECT id FROM categories LIMIT 1")
    const categoryId = catRes.rows.length > 0 ? catRes.rows[0].id : 1

    const res = await client.query(`
      INSERT INTO "products" (
        name, created_at, updated_at, is_available, is_veg, is_stock, is_out_of_stock,
        default_price_details_price, default_price_details_rate, default_price_details_quantity,
        category_id, default_price_details_unit, default_price_details_gst
      ) VALUES ($1, NOW(), NOW(), true, true, true, false, 0, 0, 1, $2, 'pcs', '0')
      RETURNING id
    `, ['Legacy/Deleted Product', categoryId])

    console.log('Created Legacy Product with ID:', res.rows[0].id)
  } catch (err) {
    console.error('Error creating legacy product:', err)
  } finally {
    await client.end()
    process.exit(0)
  }
}

run()

