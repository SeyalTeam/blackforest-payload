export type KitchenDoc = {
  id: string
  name: string
  branches?: unknown
  categories?: unknown
}

export type BranchDoc = {
  id: string
  name: string
}

export type CategoryDoc = {
  id: string
  name: string
}

export type UserDoc = {
  id: string
  name: string
  role?: string
}

export type ProductDoc = {
  id: string
  name: string
  category?: unknown
  preparationTime?: unknown
}

export type PreparationStatus = 'exceeded' | 'lower' | 'neutral'

export type BillPreparationDetail = {
  billingId: string
  billNumber: string
  productId: string
  productName: string
  orderedAt: string
  preparedAt: string
  preparationTime: number | null
  chefPreparationTime: number | null
  productStandardPreparationTime: number | null
  chefName: string
  quantity: number
  status: PreparationStatus
}

export type BillItem = {
  id?: unknown
  product?: unknown
  name?: unknown
  quantity?: unknown
  preparingTime?: unknown
  orderedAt?: unknown
  preparedAt?: unknown
  unitPrice?: unknown
  gstRate?: unknown
  finalLineTotal?: unknown
  subtotal?: unknown
  status?: unknown
}

export type BillingDoc = {
  id?: string
  invoiceNumber?: unknown
  kotNumber?: unknown
  company?: unknown
  createdAt?: unknown
  customerDetails?: {
    name?: unknown
    phoneNumber?: unknown
  } | null
  tableDetails?: {
    section?: unknown
    tableNumber?: unknown
  } | null
  paymentMethod?: unknown
  subTotal?: unknown
  cgstAmount?: unknown
  sgstAmount?: unknown
  roundOffAmount?: unknown
  totalAmount?: unknown
  createdBy?: unknown
  branch?: unknown
  items?: BillItem[] | null
}

export type ApiListResponse<T> = {
  docs?: T[]
}
