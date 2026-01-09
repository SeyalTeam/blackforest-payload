'use client'
import React, { useEffect, useState } from 'react'
import { useField } from '@payloadcms/ui'
import './index.scss'

type Props = {
  path: string
  value?: any // fallback
}

const CustomerBillsTable: React.FC<Props> = ({ path, value: initialValue }) => {
  const { value } = useField({ path: path || 'bills' }) // default to 'bills' if path is missing

  // Use value from hook, or fallback to initialValue
  const activeValue = value || initialValue

  const [bills, setBills] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchBills = async () => {
      // If no value or empty array, ensure bills is empty
      if (!activeValue || (Array.isArray(activeValue) && activeValue.length === 0)) {
        setBills([])
        return
      }

      setLoading(true)
      try {
        // activeValue can be array of strings (IDs) or objects (populated docs)
        const ids = Array.isArray(activeValue)
          ? activeValue.map((v: any) => (typeof v === 'object' ? v.id : v)).filter(Boolean)
          : []

        if (ids.length === 0) {
          setBills([])
          setLoading(false)
          return
        }

        // Construct query manually
        const queryParams = ids.map((id, index) => `where[id][in][${index}]=${id}`).join('&')

        const response = await fetch(`/api/billings?${queryParams}&depth=0&limit=100`)
        const data = await response.json()

        if (data.docs) {
          // Sort by date desc (newest first)
          const sortedBills = data.docs.sort(
            (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          setBills(sortedBills)
        }
      } catch (error) {
        console.error('Error fetching bills:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBills()
  }, [activeValue])

  if (loading) {
    return <div className="customer-bills-table loading">Loading bills...</div>
  }

  if (!bills || bills.length === 0) {
    return (
      <div className="customer-bills-table no-bills">
        No bills found.
        <br />
        <small style={{ fontSize: '10px', color: '#888' }}>
          Debug Value: {JSON.stringify(activeValue)}
        </small>
      </div>
    )
  }

  return (
    <div className="customer-bills-table-container">
      <table className="customer-bills-table">
        <thead>
          <tr>
            <th>Bill Number</th>
            <th>Date</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {bills.map((bill) => (
            <tr key={bill.id}>
              <td>{bill.invoiceNumber || 'N/A'}</td>
              <td>
                {bill.createdAt ? new Date(bill.createdAt).toLocaleDateString('en-GB') : 'N/A'}
              </td>
              <td>{bill.totalAmount?.toFixed(2) || '0.00'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default CustomerBillsTable
