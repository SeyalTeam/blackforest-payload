import { PayloadHandler } from 'payload'
import mongoose from 'mongoose'

export const updateExpenseEmployeeHandler: PayloadHandler = async (req): Promise<Response> => {
  const { payload } = req

  // Authenticate user
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await (req as any).json()
    const { expenseId, detailId, employeeId } = body || {}

    if (!expenseId || !detailId) {
      return Response.json({ message: 'expenseId and detailId are required' }, { status: 400 })
    }

    let employeeDoc: any = null
    if (employeeId && typeof employeeId === 'string' && employeeId.trim().length > 0) {
      employeeDoc = await payload.findByID({
        collection: 'employees',
        id: employeeId,
        depth: 0,
        overrideAccess: true,
      })
    }

    const resolvedEmployeeId = employeeDoc ? employeeDoc.id : null

    // 1. Direct MongoDB update on details array
    const ExpenseModel = payload.db.collections['expenses']
    if (ExpenseModel) {
      const matchCriteria: any[] = []
      if (mongoose.Types.ObjectId.isValid(expenseId)) {
        matchCriteria.push({ _id: new mongoose.Types.ObjectId(expenseId) })
      }
      matchCriteria.push({ _id: expenseId })

      const detailMatchCriteria: any[] = []
      if (mongoose.Types.ObjectId.isValid(detailId)) {
        detailMatchCriteria.push({ 'details._id': new mongoose.Types.ObjectId(detailId) })
      }
      detailMatchCriteria.push({ 'details._id': detailId })
      detailMatchCriteria.push({ 'details.id': detailId })

      const empValue = resolvedEmployeeId
        ? mongoose.Types.ObjectId.isValid(resolvedEmployeeId)
          ? new mongoose.Types.ObjectId(resolvedEmployeeId)
          : resolvedEmployeeId
        : null

      await ExpenseModel.updateOne(
        {
          $or: matchCriteria,
          $and: [{ $or: detailMatchCriteria }],
        },
        {
          $set: {
            'details.$.employee': empValue,
          },
        },
      )
    }

    // 2. Also update via Payload API to trigger any hooks/timestamps
    try {
      const expenseDoc = await payload.findByID({
        collection: 'expenses',
        id: expenseId,
        depth: 0,
        overrideAccess: true,
      })

      if (expenseDoc && Array.isArray(expenseDoc.details)) {
        const updatedDetails = expenseDoc.details.map((d: any) => {
          const currentId = String(d.id || d._id)
          if (currentId === String(detailId)) {
            return {
              ...d,
              employee: resolvedEmployeeId || null,
            }
          }
          return d
        })

        await payload.update({
          collection: 'expenses',
          id: expenseId,
          data: {
            details: updatedDetails,
          },
          overrideAccess: true,
        })
      }
    } catch (err) {
      req.payload.logger.warn(`Payload update fallback note: ${err}`)
    }

    return Response.json({
      success: true,
      expenseId,
      detailId,
      employeeId: resolvedEmployeeId,
      employeeName: employeeDoc ? employeeDoc.name : null,
      employeeRole: employeeDoc ? employeeDoc.team || null : null,
    })
  } catch (error) {
    payload.logger.error(error)
    return Response.json(
      { message: error instanceof Error ? error.message : 'Error updating employee' },
      { status: 500 },
    )
  }
}
