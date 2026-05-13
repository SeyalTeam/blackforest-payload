import pg from 'pg'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config()

const MAPPING_FILE = path.join(process.cwd(), 'migration-data', 'id-mapping.json')

const loadMapping = () => {
  if (fs.existsSync(MAPPING_FILE)) {
    return JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'))
  }
  return {}
}

const run = async () => {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URI,
  })

  const mapping = loadMapping()
  if (!mapping.billings) mapping.billings = {}

  try {
    await client.connect()
    console.log('Connected to database')

    const legacyProductRes = await client.query("SELECT id FROM products WHERE name = 'Legacy/Deleted Product'")
    const legacyProductId = legacyProductRes.rows.length > 0 ? legacyProductRes.rows[0].id : null

    const filePath = path.join(process.cwd(), 'migration-data', 'billings.json')
    if (!fs.existsSync(filePath)) {
      console.error('billings.json not found.')
      return
    }

    console.log('Reading existing billings to prevent duplicates...')
    const existingRes = await client.query('SELECT invoice_number FROM billings')
    const existingInvoices = new Set(existingRes.rows.map(r => r.invoice_number))

    console.log('Reading billings.json... (this may take a moment)')
    const docs = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    console.log(`Processing ${docs.length} billing records...`)

    let successCount = 0
    let skipCount = 0

    for (const doc of docs) {
      if (mapping.billings[doc.id] || existingInvoices.has(doc.invoiceNumber)) {
        skipCount++
        continue
      }

      try {
        // Map Relationships
        const branchId = mapping.branches?.[doc.branch] || null
        const companyId = mapping.companies?.[doc.company] || null
        const createdById = mapping.users?.[doc.createdBy] || 1 // Fallback to Superadmin if missing

        // Map status safely
        let status = doc.status || 'ordered'
        if (status === 'pending' || status === 'draft') status = 'ordered'

        const query = `
          INSERT INTO "billings" (
            invoice_number, kot_number, status, payment_method, 
            sub_total, total_taxable_amount, total_g_s_t_amount, cgst_amount, sgst_amount,
            total_amount_before_round_off, round_off_amount, total_amount, gross_amount,
            branch_id, company_id, created_by_id, notes,
            customer_details_name, customer_details_phone_number, customer_details_address,
            table_details_table_number, table_details_section,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
          RETURNING id
        `
        const values = [
          doc.invoiceNumber || '',
          doc.kotNumber || '',
          status,
          doc.paymentMethod || 'cash',
          doc.subTotal || 0,
          doc.totalTaxableAmount || 0,
          doc.totalGSTAmount || 0,
          doc.cgstAmount || 0,
          doc.sgstAmount || 0,
          doc.totalAmountBeforeRoundOff || 0,
          doc.roundOffAmount || 0,
          doc.totalAmount || 0,
          doc.grossAmount || 0,
          branchId,
          companyId,
          createdById,
          doc.notes || '',
          doc.customerDetails?.name || '',
          doc.customerDetails?.phoneNumber || '',
          doc.customerDetails?.address || '',
          doc.tableDetails?.tableNumber || '',
          doc.tableDetails?.section || '',
          doc.createdAt,
          doc.updatedAt
        ]

        const res = await client.query(query, values)
        const newBillingId = res.rows[0].id
        mapping.billings[doc.id] = newBillingId

        // Insert Items
        if (doc.items && Array.isArray(doc.items)) {
          for (let i = 0; i < doc.items.length; i++) {
            const item = doc.items[i]
            let productId = mapping.products?.[item.product] || legacyProductId
            
            // If even legacy product is null (shouldn't happen), skip item to avoid crash
            if (!productId) {
               console.warn(`Skipping item in billing ${doc.invoiceNumber} due to missing product and legacy product fallback.`)
               continue
            }
            const confirmedById = mapping.users?.[item.confirmedBy] || null
            const preparedById = mapping.users?.[item.preparedBy] || null
            const deliveredById = mapping.users?.[item.deliveredBy] || null

            const itemQuery = `
              INSERT INTO "billings_items" (
                _parent_id, _order, id, name, quantity, unit_price, subtotal, 
                taxable_amount, gst_amount, cgst_amount, sgst_amount, gst_rate, 
                final_line_total, status, notes, product_id,
                confirmed_by_id, prepared_by_id, delivered_by_id,
                ordered_at, confirmed_at, prepared_at, delivered_at, cancelled_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
            `
            const itemValues = [
              newBillingId,
              i + 1,
              item.id || `item_${i}`,
              item.name || '',
              item.quantity || 1,
              item.unitPrice || 0,
              item.subtotal || 0,
              item.taxableAmount || 0,
              item.gstAmount || 0,
              item.cgstAmount || 0,
              item.sgstAmount || 0,
              item.gstRate || 0,
              item.finalLineTotal || 0,
              item.status || 'pending',
              item.notes || '',
              productId,
              confirmedById,
              preparedById,
              deliveredById,
              item.orderedAt || null,
              item.confirmedAt || null,
              item.preparedAt || null,
              item.deliveredAt || null,
              item.cancelledAt || null
            ]
            await client.query(itemQuery, itemValues)
          }
        }

        successCount++
        if (successCount % 1000 === 0) {
          console.log(`Progress: ${successCount} billings imported...`)
          // Update mapping file every 5000 to save progress
          if (successCount % 5000 === 0) {
            fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2))
          }
        }
      } catch (e) {
        console.error(`Failed to insert billing ${doc.invoiceNumber}:`, e.message)
      }
    }

    fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2))
    console.log(`Summary: Success ${successCount}, Skipped ${skipCount}`)

  } catch (err) {
    console.error('Error:', err)
  } finally {
    await client.end()
    process.exit(0)
  }
}

run()
