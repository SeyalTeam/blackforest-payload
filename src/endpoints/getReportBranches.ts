import type { PayloadHandler, PayloadRequest } from 'payload'
import { resolveReportBranchScope } from './reportScope'

export const getReportBranchesHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const branchParam = typeof req.query.branch === 'string' ? req.query.branch : null
  const { branchIds, errorResponse } = await resolveReportBranchScope(req, branchParam)
  if (errorResponse) return errorResponse

  const result = await req.payload.find({
    collection: 'branches',
    where: branchIds
      ? {
          id: {
            in: branchIds,
          },
        }
      : undefined,
    sort: 'name',
    depth: 0,
    limit: 1000,
    pagination: false,
  })

  return Response.json({
    docs: result.docs,
    totalDocs: result.docs.length,
  })
}
