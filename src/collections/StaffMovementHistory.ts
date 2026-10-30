import type { CollectionConfig } from 'payload'
import { getDistanceFromLatLonInMeters, isPointInsideGeofence } from '../utilities/geo'

export const StaffMovementHistory: CollectionConfig = {
  slug: 'staff-movement-history',
  admin: {
    useAsTitle: 'timestamp',
    defaultColumns: ['user', 'branch', 'timestamp', 'latitude', 'longitude', 'accuracy', 'distanceToBranch'],
    group: 'Attendance & Tracking',
    description: 'High-frequency GPS telemetry breadcrumbs decoupled from attendance records and payroll cost centers.',
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: ({ req: { user } }) => {
      if (!user) return false
      if (['superadmin', 'admin', 'company', 'manager'].includes(user.role)) return true
      if (user.role === 'branch') {
        const branchId = typeof user.branch === 'string' ? user.branch : (user.branch as any)?.id
        return {
          branch: {
            equals: branchId,
          },
        } as any
      }
      return {
        user: {
          equals: user.id,
        },
      } as any
    },
    update: () => false, // Immutable append-only telemetry history
    delete: ({ req: { user } }) =>
      user?.role ? ['superadmin', 'admin'].includes(user.role) : false,
  },
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data) return data

        // 1. Ensure user is set from authenticated user if omitted
        if (!data.user && req.user?.id) {
          data.user = req.user.id
        }

        // 2. Fallback branch assignment from user's lastLoginBranch / assigned branch
        if (!data.branch && req.user) {
          const u = req.user as any
          const userBranch = u.lastLoginBranch || u.branch
          if (userBranch) {
            data.branch = typeof userBranch === 'string' ? userBranch : userBranch.id || userBranch
          }
        }

        // 3. Set timestamp if omitted
        if (!data.timestamp) {
          data.timestamp = new Date().toISOString()
        }

        // 4. Calculate distanceToBranch if branch and coordinates exist
        if (data.branch && typeof data.latitude === 'number' && typeof data.longitude === 'number' && !data.distanceToBranch) {
          try {
            const branchId = typeof data.branch === 'string' ? data.branch : data.branch.id
            if (branchId) {
              const geoSettingsResult = await req.payload.findGlobal({ slug: 'branch-geo-settings' as any })
              const geoSettings = geoSettingsResult as any
              const loc = geoSettings?.locations?.find((l: any) => {
                const bId = (typeof l.branch === 'string' ? l.branch : l.branch?.id) || l.branchId
                return String(bId) === String(branchId)
              })

              let branchLat = loc?.latitude
              let branchLng = loc?.longitude
              let branchDoc: any = null

              if (branchLat == null || branchLng == null) {
                branchDoc = await req.payload.findByID({
                  collection: 'branches',
                  id: branchId,
                  depth: 0,
                  overrideAccess: true,
                })
                branchLat = branchDoc?.latitude
                branchLng = branchDoc?.longitude
              }

              if (branchLat != null && branchLng != null) {
                const bLatNum = typeof branchLat === 'number' ? branchLat : parseFloat(branchLat)
                const bLngNum = typeof branchLng === 'number' ? branchLng : parseFloat(branchLng)
                if (!isNaN(bLatNum) && !isNaN(bLngNum)) {
                  const dist = getDistanceFromLatLonInMeters(data.latitude, data.longitude, bLatNum, bLngNum)
                  data.distanceToBranch = Math.round(dist * 10) / 10

                  // Suppress indoor telemetry while staff is inside the assigned branch boundary (Option 1)
                  if (loc) {
                    if (isPointInsideGeofence(data.latitude, data.longitude, loc)) {
                      throw new Error('User is inside branch boundary; indoor movement telemetry is ignored.')
                    }
                  } else {
                    const fallbackRadius = branchDoc?.radius || 100
                    if (dist <= fallbackRadius) {
                      throw new Error('User is inside branch boundary; indoor movement telemetry is ignored.')
                    }
                  }
                }
              }
            }
          } catch (_) {
            // Distance calculation failure should not block telemetry write
          }
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'Employee who generated this coordinate ping',
      },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      index: true,
      admin: {
        description: 'The PIN-locked branch assigned to the staff member during this session',
      },
    },
    {
      name: 'latitude',
      type: 'number',
      required: true,
      admin: {
        description: 'WGS84 Latitude',
      },
    },
    {
      name: 'longitude',
      type: 'number',
      required: true,
      admin: {
        description: 'WGS84 Longitude',
      },
    },
    {
      name: 'accuracy',
      type: 'number',
      admin: {
        description: 'GPS accuracy uncertainty in meters (from mobile OS location API)',
      },
    },
    {
      name: 'distanceToBranch',
      type: 'number',
      admin: {
        description: 'Distance to assigned branch boundary/center in meters',
      },
    },
    {
      name: 'timestamp',
      type: 'date',
      required: true,
      index: true,
      timezone: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
          displayFormat: 'yyyy-MM-dd HH:mm:ss',
        },
        description: 'Timestamp when location was captured',
      },
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'foreground',
      options: [
        { label: 'Foreground Watcher', value: 'foreground' },
        { label: 'Background Service', value: 'background' },
      ],
      admin: {
        description: 'Origin of telemetry ping',
      },
    },
  ],
}

export default StaffMovementHistory
