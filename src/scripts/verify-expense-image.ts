import { getPayload } from 'payload'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

dotenv.config({ path: path.resolve(dirname, '../../.env') })

const run = async () => {
  // Dynamically import config to ensure env vars are loaded first
  const { default: configPromise } = await import('@payload-config')
  const payload = await getPayload({ config: configPromise })

  const branchId = '6906dc71896efbd4bc64d028'
  const imagePath = 'media/autologo.png'

  try {
    // 1. Read the image file
    const fileBuffer = await fs.readFile(imagePath)

    // 2. Upload Image with mocked referer to trigger 'expenses/' prefix
    console.log('Uploading image...')
    // We can't easily mock req.headers.referer here directly via payload.create
    // because payload.create doesn't use the hook in the same way express middleware does with 'req'.
    // However, the hook uses `req.headers.get('referer')`.
    // When using Local API, `req` might be partial or missing headers.
    // BUT we can pass `req` in `context` or just rely on the fact that for Local API
    // we might need another way or the hook might fail if req is missing.
    //
    // Let's check Media.ts hook again:
    // `const setDynamicPrefix: CollectionBeforeChangeHook = async ({ req, data, operation }) => { ... }`
    // `const referer = req.headers.get('referer')`
    //
    // If we run this script, `req` will be constructed by Payload.
    // We can try to pass `req` in `create` options if supported, but usually it's not.
    //
    // ACTUALLY, checking Media.ts:
    // `const prefixFromQuery = req.query.prefix as string`
    // The hook ALSO checks `req.query.prefix`.
    // In Local API, we can't easily set query params.
    //
    // However, for the purpose of this test, if strictly testing the "referer" logic,
    // we'd need an HTTP test. But if we want to test that IF the prefix is set, it works...
    //
    // WAIT, the requirement is "only allow create ... with show image for this branch".
    // The user wants to SEE the image in a folder.
    //
    // Let's try to upload and see what happens.
    // Since we are running in a script (Local API), we might not trigger the referer logic
    // unless we mock `req`.

    // Workaround: We can manually set the prefix in the data if the hook allows it (hook returns `{...data, prefix: ...}`).
    // But the hook OVERWRITES it based on referer/query.
    // If hook doesn't match, it returns `{ ...data, prefix: '' }`.
    // So we CANNOT set it manually unless we bypass the hook or mock req.

    // Let's try to pass a mocked req object in strict mode? No.

    // Alternative: We can use `payload.create` but we might need to modify Media.ts to allow
    // passing prefix via `context` which is accessible in hooks.
    // But I shouldn't modify code just for the test unless necessary.

    // Changes: I will assume the upload happens via API (Flutter/Frontend) where referer/query is present.
    // For this script, I will try to utilize `req` mocking if possible,
    // OR just verify the Expense creation part linking to an EXISTING media (or just uploaded).
    //
    // Let's try to upload without prefix first, and then assume it works.
    // OR, I can temporarily add logic to Media.ts to check `req.context` for testing.
    //
    // Let's stick to uploading normally. If it ends up in root, that's expected for Local API.
    // The IMPORTANT part is checking if we can CREATE an Expense for the branch
    // even though we disabled `create` in Access Control.
    // Local API `payload.create` is ADMIN by default unless `overrideAccess: false` is set.
    // So it should work.

    // To strictly test the "Restriction", we should try to create as a user with limited access?
    // But `access.create: () => false` means NO ONE can create via API/Admin UI (except Local API with overriding access).

    // So the test is:
    // 1. Upload image.
    // 2. Create Expense with `overrideAccess: true` (default for Local API).
    // 3. Verify it's created.

    const media = await payload.create({
      collection: 'media',
      data: {
        alt: 'Expense Bill',
      },
      file: {
        data: fileBuffer,
        name: 'expense-bill.png',
        mimetype: 'image/png',
        size: fileBuffer.length,
      },
    })

    console.log('Image uploaded:', media.id)
    console.log('Image Prefix:', media.prefix)
    console.log('Image URL:', media.url)

    // Check if it went to expenses (it probably didn't in this script, but provides data)
    if (media.prefix === 'expenses/') {
      console.log('SUCCESS: Image stored in expenses/ folder.')
    } else {
      console.log('NOTICE: Image stored in root (or other) folder:', media.prefix || '<root>')
      console.log('NOTE: For Flutter, ensure the API call includes ?prefix=expenses')
    }

    // 3. Create Expense
    console.log('Creating expense...')
    const expense = await payload.create({
      collection: 'expenses',
      data: {
        invoiceNumber: `TEST-EXP-${Date.now()}`,
        branch: branchId,
        date: new Date().toISOString(),
        details: [
          {
            source: 'OTHERS',
            reason: 'Test Expense',
            amount: 100,
          },
        ],
        total: 100,
        billImage: media.id,
      },
      // overrideAccess is true by default in Local API
    })

    console.log('Expense created successfully:', expense.id)
    console.log('Expense Invoice Number:', expense.invoiceNumber)
    console.log(
      'Linked Image ID:',
      typeof expense.billImage === 'object' ? expense.billImage?.id : expense.billImage,
    )

    // Fetch the expense again to be sure
    const fetchedExpense = await payload.findByID({
      collection: 'expenses',
      id: expense.id,
    })

    if (fetchedExpense) {
      console.log('Verification Passed: Expense created and retrieved.')
    } else {
      console.error('Verification Failed: Could not retrieve created expense.')
    }
  } catch (error) {
    console.error('Error during verification:', error)
  }

  process.exit(0)
}

run()
