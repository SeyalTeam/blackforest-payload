import { CollectionConfig } from 'payload'
import { isIPAllowed } from '../utilities/ipCheck'
import { invalidateMenuCache } from '../utilities/menuCache'

const calculateEAN13CheckDigit = (eanWithoutCheckDigit: string): number => {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(eanWithoutCheckDigit[i], 10)
    sum += i % 2 === 0 ? digit : digit * 3
  }
  return (10 - (sum % 10)) % 10
}

const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name', // Displays name in admin UI list
    group: 'Inventory', // Groups under a section in sidebar
  },
  access: {
    // Make read public (anyone can access without login)
    read: async ({ req }) => {
      // Allow full access for admins/company if no specific branch query is present
      if (
        req.user &&
        ['superadmin', 'admin', 'company', 'account'].includes(req.user.role) &&
        !req.query?.branch
      ) {
        return true
      }

      // Get branch ID from user or query
      let branchId: string | null = null

      // Priority 1: Query param (allows admins to test branch view, or public to filter)
      if (req.query?.branch && typeof req.query.branch === 'string') {
        branchId = req.query.branch
      }
      // Priority 2: User's assigned branch
      else if (req.user?.branch) {
        branchId = typeof req.user.branch === 'string' ? req.user.branch : req.user.branch.id
      }
      // Priority 3: Detect Branch by IP (for waiters/devices on branch WiFi)
      else {
        // Optimization: Skip IP check if user is already authenticated but has no branch (e.g. Superadmin)
        if (req.user && ['superadmin', 'admin', 'company', 'account'].includes(req.user.role)) {
          return true
        }

        // Detect Public IP
        let clientIp = '127.0.0.1'
        if (req.headers && typeof req.headers.get === 'function') {
          const forwarded = req.headers.get('x-forwarded-for')
          const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null
          if (ip) clientIp = ip
        } else if ((req as any).ip) {
          clientIp = (req as any).ip
        }

        if (clientIp && clientIp !== '127.0.0.1') {
          // Log detected IP for debugging
          try {
            // Fetch lean branches (depth: 0, specific fields) with a slightly longer timeout
            const branchesPromise = req.payload.find({
              collection: 'branches',
              depth: 0,
              limit: 100,
              pagination: false,
              // select: { id: true, name: true, ipAddress: true }, // Optimization if supported by adapter
              overrideAccess: true,
            })

            const branches = await Promise.race([
              branchesPromise,
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Branch fetch timeout (5s)')), 5000),
              ),
            ])

            if (branches && branches.docs) {
              for (const branch of branches.docs) {
                if (branch.ipAddress && isIPAllowed(clientIp, branch.ipAddress)) {
                  branchId = branch.id
                  console.log(
                    `[Products Access] Match Found: ${clientIp} -> ${branch.name} (${branch.id})`,
                  )
                  break
                }
              }
            }
          } catch (error: any) {
            console.error(`[Products Access] IP Check Failed for ${clientIp}: ${error.message || error}`)
          }
        }
      }

      if (branchId) {
        return {
          inactiveBranches: {
            not_equals: branchId,
          },
        }
      }

      return true
    },
    create: ({ req: { user } }) =>
      user?.role === 'superadmin' ||
      user?.role === 'admin' ||
      user?.role === 'company' ||
      user?.role === 'branch',
    update: () => true, // Made public to allow updates without authentication
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  hooks: {
    beforeChange: [
	      async ({ data, req, operation, originalDoc: _originalDoc }) => {
        if (operation === 'create') {
          // Generate sequential productId
          const lastProduct = await req.payload.find({
            collection: 'products',
            limit: 1,
            sort: '-productId',
          })
          const lastProductId = lastProduct.docs[0]?.productId || '00000'
          const nextProductIdNum = parseInt(lastProductId, 10) + 1
          const nextProductId = nextProductIdNum.toString().padStart(5, '0')
          data.productId = nextProductId

          // Generate UPC if not provided (for branded products, allow manual entry)
          if (!data.upc) {
            const companyPrefix = '8901234' // Hardcoded as per previous code
            const eanWithoutCheckDigit = companyPrefix + nextProductId
            const checkDigit = calculateEAN13CheckDigit(eanWithoutCheckDigit)
            data.upc = eanWithoutCheckDigit + checkDigit.toString()
          } else {
            // Validate provided UPC (optional: add length/check digit validation)
            if (data.upc.length !== 13 || isNaN(parseInt(data.upc))) {
              throw new Error('Invalid UPC: Must be 13 digits')
            }
          }
        } else if (operation === 'update') {
          // Allow updating UPC on edit if needed
        }

        const hasExplicitStock = typeof data.isStock === 'boolean'
        const hasExplicitOutOfStock = typeof data.isOutOfStock === 'boolean'

        if (hasExplicitStock) {
          data.isOutOfStock = !data.isStock
        } else if (hasExplicitOutOfStock) {
          data.isStock = !data.isOutOfStock
        }

        // Existing duplicate branch check
        if (data.branchOverrides && data.branchOverrides.length > 0) {
          const seenBranches = new Set()
          for (const override of data.branchOverrides) {
            if (!override.branch) {
              throw new Error('Branch is required for overrides')
            }
            if (seenBranches.has(override.branch)) {
              throw new Error('Duplicate branch in overrides not allowed')
            }
            seenBranches.add(override.branch)
          }
        }

        return data
      },
    ],
    afterChange: [
      () => {
        invalidateMenuCache()
      },
    ],
    afterDelete: [
      () => {
        invalidateMenuCache()
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true, // Prevent duplicate product names
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories', // Link to existing Categories collection
      required: true,
      admin: {
        position: 'sidebar', // Place in sidebar for easy selection
      },
    },
    {
      name: 'dealer',
      type: 'relationship',
      relationTo: 'dealers', // Link to Dealers collection
      hasMany: true,
      required: false, // Optional, as not all products may have dealers
      admin: {
        position: 'sidebar', // After category in sidebar
        description: 'Select one or more dealers for this product.',
      },
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      hasMany: true,
      label: 'Companies / Branches',
      admin: {
        position: 'sidebar',
        description: 'Select one or more companies/branches for this product.',
      },
    },
    {
      name: 'expiryDays',
      type: 'number',
      label: 'Expiry Days',
      admin: {
        position: 'sidebar',
        description: 'Number of days the product is valid for after production/purchase.',
      },
    },
    {
      name: 'preparationTime',
      type: 'number',
      label: 'Preparation Time',
      admin: {
        position: 'sidebar',
        description: 'Preparation time in minutes.',
      },
    },
    {
      name: 'standardStockLevel',
      type: 'number',
      label: 'Standard Stock Level',
      admin: {
        position: 'sidebar',
        description: 'Target or standard stock level to maintain.',
      },
    },
    {
      name: 'minimumStockLevel',
      type: 'number',
      label: 'Minimum Stock Level',
      admin: {
        position: 'sidebar',
        description: 'Notify when stock falls below this level.',
      },
    },
    {
      name: 'maximumStockLevel',
      type: 'number',
      label: 'Maximum Stock Level',
      admin: {
        position: 'sidebar',
        description: 'Notify when stock exceeds this level.',
      },
    },
    {
      name: 'packSize',
      type: 'number',
      label: 'Weight / Pack Size per Unit',
      admin: {
        position: 'sidebar',
        description: 'Weight or size per unit (e.g. 15 for 15 L tin, 25 for 25 kg bag, 1 for 1 kg/piece).',
      },
    },
    {
      name: 'purchaseFrequency',
      type: 'select',
      label: 'Purchase Frequency',
      options: [
        { label: 'Daily', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Monthly', value: 'monthly' },
        { label: '3 Months', value: '3month' },
        { label: '6 Months', value: '6month' },
        { label: 'Yearly', value: 'yearly' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Frequency of purchase (Daily, Weekly, Monthly, 3 Months, 6 Months, Yearly).',
      },
    },
    {
      name: 'variants',
      type: 'array',
      label: 'Packaging Variants',
      admin: {
        description: 'Define the packaging options available for this product (e.g. 25 kg Bag, 15 L Tin, 50 Pcs Box).',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Variant Name (e.g., 25 kg Bag, 15 L Tin)',
          required: true,
        },
        {
          name: 'weight',
          type: 'number',
          label: 'Weight / Pack Size per Unit (e.g. 25 for 25 kg Bag, 15 for 15 L Tin)',
          required: true,
        },
        {
          name: 'unit',
          type: 'select',
          label: 'Unit',
          options: [
            { label: 'Pieces (pcs)', value: 'pcs' },
            { label: 'Kilograms (kg)', value: 'kg' },
            { label: 'Grams (g)', value: 'g' },
            { label: 'Liters (l)', value: 'l' },
            { label: 'Milliliters (ml)', value: 'ml' },
            { label: 'Bags (bag)', value: 'bag' },
            { label: 'Tins (tin)', value: 'tin' },
            { label: 'Boxes (box)', value: 'box' },
            { label: 'Cans (can)', value: 'can' },
            { label: 'Drums (drum)', value: 'drum' },
            { label: 'Bottles (bottle)', value: 'bottle' },
            { label: 'Cartons (carton)', value: 'carton' },
            { label: 'Packs (pack)', value: 'pack' },
          ],
          required: true,
          defaultValue: 'kg',
        },
        {
          name: 'standardStockLevel',
          type: 'number',
          label: 'Standard Stock Level',
          admin: {
            description: 'Target or standard stock level to maintain for this variant.',
          },
        },
        {
          name: 'minimumStockLevel',
          type: 'number',
          label: 'Minimum Stock Level',
          admin: {
            description: 'Notify when stock falls below this level for this variant.',
          },
        },
        {
          name: 'maximumStockLevel',
          type: 'number',
          label: 'Maximum Stock Level',
          admin: {
            description: 'Notify when stock exceeds this level for this variant.',
          },
        },
        {
          name: 'purchaseFrequency',
          type: 'select',
          label: 'Purchase Frequency',
          options: [
            { label: 'Daily', value: 'daily' },
            { label: 'Weekly', value: 'weekly' },
            { label: 'Monthly', value: 'monthly' },
            { label: '3 Months', value: '3month' },
            { label: '6 Months', value: '6month' },
            { label: 'Yearly', value: 'yearly' },
          ],
          admin: {
            description: 'Frequency of purchase for this variant (Daily, Weekly, Monthly, 3 Months, 6 Months, Yearly).',
          },
        },
        {
          name: 'company',
          type: 'relationship',
          relationTo: 'companies',
          hasMany: true,
          label: 'Companies / Branches',
          admin: {
            description: 'Select one or more companies/branches for this variant.',
          },
        },
      ],
    },
    {
      name: 'images',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media', // Assume Media collection exists for uploads
          required: true,
        },
      ],
      minRows: 1,
      maxRows: 5, // Limit to a few images
      admin: {
        position: 'sidebar', // Moved to right side (sidebar), after category
      },
    },
    {
      name: 'hsnCode',
      type: 'text',
      required: false, // Manual input, optional
      label: 'HSN Code',
      admin: {
        position: 'sidebar', // Before productId in sidebar
      },
    },
    {
      name: 'productId',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true, // Auto-generated
        position: 'sidebar', // Moved to sidebar, after images
      },
    },
    {
      name: 'upc',
      type: 'text',
      unique: true,
      required: false, // Made optional for manual entry
      admin: {
        position: 'sidebar', // Moved to sidebar, after images
      },
    },
    {
      type: 'row', // Groups the next fields horizontally in the same row
      fields: [
        {
          name: 'isVeg',
          type: 'checkbox',
          defaultValue: false,
          label: 'Is Vegetarian',
        },
        {
          name: 'isAvailable',
          type: 'checkbox',
          defaultValue: true,
          label: 'Is Available',
        },
        {
          name: 'isStock',
          type: 'checkbox',
          defaultValue: true,
          index: true,
          label: 'Is Stock',
        },
        {
          name: 'isOutOfStock',
          type: 'checkbox',
          defaultValue: false,
          index: true,
          label: 'Is Out Of Stock',
        },
      ],
    },
    {
      name: 'defaultPriceDetails',
      type: 'group', // Default pricing applied to all branches unless overridden
      label: 'Default Price Details',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'enableAC',
              type: 'checkbox',
              defaultValue: false,
              label: 'Enable AC',
              admin: {
                width: '50%',
              },
            },
            {
              name: 'enableNonAC',
              type: 'checkbox',
              defaultValue: false,
              label: 'Enable NON AC',
              admin: {
                width: '50%',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'price',
              type: 'number',
              required: true,
              min: 0,
              max: 999999,
              label: 'Price (MRP)',
              admin: {
                width: '33%',
                step: 1,
              },
            },
            {
              name: 'acPrice',
              type: 'number',
              min: 0,
              max: 999999,
              label: 'AC',
              admin: {
                width: '33%',
                step: 1,
                condition: (_data, siblingData) => Boolean(siblingData?.enableAC),
              },
            },
            {
              name: 'nonACPrice',
              type: 'number',
              min: 0,
              max: 999999,
              label: 'NON AC',
              admin: {
                width: '33%',
                step: 1,
                condition: (_data, siblingData) => Boolean(siblingData?.enableNonAC),
              },
            },
          ],
        },
        {
          name: 'rate',
          type: 'number',
          required: true,
          min: 0,
          label: 'Rate',
        },
        {
          name: 'offer',
          type: 'number',
          required: false,
          min: 0,
          max: 100,
          label: 'Offer %',
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 0,
          label: 'Quantity',
        },
        {
          name: 'unit',
          type: 'select',
          options: [
            { label: 'Pieces (pcs)', value: 'pcs' },
            { label: 'Kilograms (kg)', value: 'kg' },
            { label: 'Grams (g)', value: 'g' },
            { label: 'Liters (l)', value: 'l' },
            { label: 'Milliliters (ml)', value: 'ml' },
            { label: 'Bags (bag)', value: 'bag' },
            { label: 'Tins (tin)', value: 'tin' },
            { label: 'Boxes (box)', value: 'box' },
            { label: 'Cans (can)', value: 'can' },
            { label: 'Drums (drum)', value: 'drum' },
            { label: 'Bottles (bottle)', value: 'bottle' },
            { label: 'Cartons (carton)', value: 'carton' },
            { label: 'Packs (pack)', value: 'pack' },
          ],
          required: true,
        },
        {
          name: 'gst',
          type: 'select',
          options: [
            { label: '0%', value: '0' },
            { label: '5%', value: '5' },
            { label: '12%', value: '12' },
            { label: '18%', value: '18' },
            { label: '22%', value: '22' }, // As specified
          ],
          required: true,
          defaultValue: '0',
          label: 'GST',
        },
      ],
    },
    {
      name: 'inactiveBranches',
      type: 'relationship',
      relationTo: 'branches',
      hasMany: true,
      label: 'Inactive in Branches',
      admin: {
        description: 'Select branches where this product should be inactive.',
      },
    },
    {
      name: 'outOfStockBranches',
      type: 'relationship',
      relationTo: 'branches',
      hasMany: true,
      label: 'Out Of Stock Branches',
      admin: {
        description: 'Branches where this product should show as out of stock.',
      },
    },
    {
      name: 'branchOverrides',
      type: 'array', // Overrides for specific branches (e.g., the one at ₹12)
      label: 'Branch Overrides',
      fields: [
        {
          name: 'branch',
          type: 'relationship',
          relationTo: 'branches',
          required: true,
          label: 'Branch',
        },
        {
          name: 'price',
          type: 'number',
          min: 0,
          label: 'Override Price (MRP)', // Optional override
        },
        {
          type: 'row',
          fields: [
            {
              name: 'enableAC',
              type: 'checkbox',
              defaultValue: false,
              label: 'Enable AC',
              admin: {
                width: '50%',
              },
            },
            {
              name: 'enableNonAC',
              type: 'checkbox',
              defaultValue: false,
              label: 'Enable NON AC',
              admin: {
                width: '50%',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'acPrice',
              type: 'number',
              min: 0,
              max: 999999,
              label: 'AC',
              admin: {
                width: '50%',
                step: 1,
                condition: (_data, siblingData) => Boolean(siblingData?.enableAC),
              },
            },
            {
              name: 'nonACPrice',
              type: 'number',
              min: 0,
              max: 999999,
              label: 'NON AC',
              admin: {
                width: '50%',
                step: 1,
                condition: (_data, siblingData) => Boolean(siblingData?.enableNonAC),
              },
            },
          ],
        },
        {
          name: 'rate',
          type: 'number',
          min: 0,
          label: 'Override Rate',
        },
        {
          name: 'offer',
          type: 'number',
          min: 0,
          max: 100,
          label: 'Override Offer %',
        },
        {
          name: 'quantity',
          type: 'number',
          min: 0,
          label: 'Override Quantity',
        },
        {
          name: 'unit',
          type: 'select',
          options: [
            { label: 'Pieces (pcs)', value: 'pcs' },
            { label: 'Kilograms (kg)', value: 'kg' },
            { label: 'Grams (g)', value: 'g' },
            { label: 'Liters (l)', value: 'l' },
            { label: 'Milliliters (ml)', value: 'ml' },
            { label: 'Bags (bag)', value: 'bag' },
            { label: 'Tins (tin)', value: 'tin' },
            { label: 'Boxes (box)', value: 'box' },
            { label: 'Cans (can)', value: 'can' },
            { label: 'Drums (drum)', value: 'drum' },
            { label: 'Bottles (bottle)', value: 'bottle' },
            { label: 'Cartons (carton)', value: 'carton' },
            { label: 'Packs (pack)', value: 'pack' },
          ],
          label: 'Override Unit',
        },
        {
          name: 'gst',
          type: 'select',
          options: [
            { label: '0%', value: '0' },
            { label: '5%', value: '5' },
            { label: '12%', value: '12' },
            { label: '18%', value: '18' },
            { label: '22%', value: '22' },
          ],
          defaultValue: '0',
          label: 'Override GST',
        },
      ],
    },
  ],
  indexes: [
    {
      fields: ['category'],
    },
    {
      fields: ['category', 'name'],
    },
  ],
}

export default Products
