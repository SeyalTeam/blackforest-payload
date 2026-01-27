import 'dotenv/config'
import config from '../payload.config'
import { getPayload } from 'payload'

const fixBillNotes = async () => {
  const payload = await getPayload({ config })
  const billId = '697873f516dd417b0814528b'

  try {
    const bill = await payload.findByID({
      collection: 'billings',
      id: billId,
      depth: 0,
    })

    if (bill.notes && bill.items && bill.items.length > 0) {
      console.log('Original Root Notes:', bill.notes)

      // Attempt to find the specific item the note belongs to
      // The note is "PARCEL COFFEE: sugar "
      // The item is "PARCEL COFFEE"
      const updatedItems = bill.items.map((item: any) => {
        if (bill.notes?.startsWith(item.name + ':')) {
          const noteText = bill.notes.split(':')[1].trim()
          return {
            ...item,
            notes: noteText,
          }
        }
        // If only one item, move it anyway?
        if (bill.items.length === 1) {
          return {
            ...item,
            notes: bill.notes,
          }
        }
        return item
      })

      await payload.update({
        collection: 'billings',
        id: billId,
        data: {
          items: updatedItems,
          // We can clear the root notes or keep them
          // notes: ''
        },
      })

      console.log('Bill updated successfully.')
    } else {
      console.log('No notes or items to fix.')
    }
  } catch (error) {
    console.error('Error fixing bill notes:', error)
  }

  process.exit(0)
}

fixBillNotes()
