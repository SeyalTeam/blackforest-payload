import type { CollectionConfig } from 'payload'
import { isIPAllowed } from '../utilities/ipCheck'
import { getDistanceFromLatLonInMeters } from '../utilities/geo'
import type { IpSetting } from '../payload-types'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
  },
  auth: {
    tokenExpiration: 604800, // 7 days in seconds
  },
  fields: [
    // Email added by default
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Superadmin', value: 'superadmin' },
        { label: 'Admin', value: 'admin' },
        { label: 'Delivery', value: 'delivery' },
        { label: 'Branch', value: 'branch' },
        { label: 'Company', value: 'company' },
        { label: 'Factory', value: 'factory' }, // New
        { label: 'Kitchen', value: 'kitchen' }, // New
        { label: 'Chef', value: 'chef' }, // New
        { label: 'Cashier', value: 'cashier' }, // New
        { label: 'Waiter', value: 'waiter' }, // New
        { label: 'Supervisor', value: 'supervisor' },
        { label: 'Driver', value: 'driver' },
      ],
      defaultValue: 'admin',
      required: true,
      access: {
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: false,
      admin: {
        condition: ({ role }) => ['branch', 'kitchen'].includes(role), // Show for branch, kitchen
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin',
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      required: false,
      admin: {
        condition: ({ role }) => role === 'company',
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin',
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    {
      name: 'factory_companies',
      type: 'relationship',
      relationTo: 'companies',
      hasMany: true,
      required: false,
      admin: {
        condition: ({ role }) => role === 'factory',
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin',
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: false,
      admin: {
        condition: ({ role }) =>
          ['waiter', 'cashier', 'supervisor', 'delivery', 'driver', 'chef'].includes(role),
      },
      filterOptions: ({ siblingData }) => {
        const role = (siblingData as { role?: string }).role
        if (
          !role ||
          !['waiter', 'cashier', 'supervisor', 'delivery', 'driver', 'chef'].includes(role)
        ) {
          return false
        }
        return { team: { equals: role } }
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin',
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
  ],
  access: {
    create: ({ req }) => req.user?.role === 'superadmin',
    read: ({ req, id }) => {
      if (!req.user) return false
      return req.user.role === 'superadmin' || req.user.role === 'admin' || req.user.id === id
    },
    update: ({ req, id }) => {
      if (!req.user) return false
      return req.user.role === 'superadmin' || req.user.id === id
    },
    delete: ({ req }) => req.user?.role === 'superadmin',
  },
  hooks: {
    beforeLogin: [
      async ({ req, user }) => {
        if (user.role === 'superadmin') return

        // Skip IP check in development mode
        if (process.env.NODE_ENV === 'development') {
          return
        }

        // Initialize status flags
        let isIpAuthorized = false
        let isIpRestrictedRole = false

        // --- 1. IP Check (Global & Branch Specific) ---
        try {
          const [ipSettings, geoSettingsResult] = await Promise.all([
            req.payload.findGlobal({ slug: 'ip-settings' }),
            req.payload.findGlobal({ slug: 'branch-geo-settings' as any }),
          ])

          const ipSettingsData = ipSettings as IpSetting
          const geoSettings = geoSettingsResult as any

          const restriction = ipSettingsData.roleRestrictions?.find((r) => r.role === user.role)

          // Detect IPs
          const forwarded = req.headers.get('x-forwarded-for')
          const publicIp =
            typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '127.0.0.1'
          const privateIpHeader = req.headers.get('x-private-ip')
          const privateIp = typeof privateIpHeader === 'string' ? privateIpHeader.trim() : null

          if (user.branch) {
            const userBranchId =
              typeof user.branch === 'string' ? user.branch : (user.branch as { id: string }).id

            // A. Check Branch-specific IP from BranchGeoSettings (New)
            if (geoSettings?.locations) {
              const branchGeo = geoSettings.locations.find((loc: any) => {
                const locBranchId = typeof loc.branch === 'string' ? loc.branch : loc.branch?.id
                return locBranchId === userBranchId
              })

              if (branchGeo?.ipAddress && isIPAllowed(publicIp, [branchGeo.ipAddress])) {
                console.log(`Login authorized by BranchGeoSettings IP/Range: ${publicIp}`)
                isIpAuthorized = true
              }
            }

            // B. Check IP from Branches collection (Previous/legacy)
            if (!isIpAuthorized) {
              const branchDoc = await req.payload.findByID({
                collection: 'branches',
                id: userBranchId,
              })
              if (branchDoc?.ipAddress && isIPAllowed(publicIp, [branchDoc.ipAddress])) {
                console.log(`Login authorized by Branches collection IP/Range: ${publicIp}`)
                isIpAuthorized = true
              }
            }
          }

          // C. Check Global Role-based IP Restrictions (if not already authorized)
          if (!isIpAuthorized && restriction) {
            isIpRestrictedRole = true

            const publicAllowedRanges =
              restriction.ipRanges
                ?.filter((r: { ipType: string }) => r.ipType === 'public')
                .map((r: { ipOrRange: string }) => r.ipOrRange) || []
            const privateAllowedRanges =
              restriction.ipRanges
                ?.filter((r: { ipType: string }) => r.ipType === 'private')
                .map((r: { ipOrRange: string }) => r.ipOrRange) || []

            const isPublicAllowed =
              publicAllowedRanges.length > 0 && isIPAllowed(publicIp, publicAllowedRanges)
            const isPrivateAllowed =
              privateIp &&
              privateAllowedRanges.length > 0 &&
              isIPAllowed(privateIp, privateAllowedRanges)

            if (isPublicAllowed || isPrivateAllowed) {
              isIpAuthorized = true
            } else {
              console.warn(
                `IP Check Failed for ${user.role}. Public: ${publicIp}, Private: ${privateIp}`,
              )
            }
          } else if (!restriction) {
            // No restriction for this role -> default authorized
            isIpAuthorized = true
          }
        } catch (error) {
          console.error('IP Check Error:', error)
          // Fallback to Geo if IP check fails or encounters error
        }

        // If IP is good, we are done
        if (isIpAuthorized) return

        // --- 2. Geo Location Check (Fallback) ---
        let isGeoAuthorized = false

        const geoCheckRequiredRoles = ['branch', 'kitchen', 'cashier', 'waiter', 'supervisor']

        // Check if user has a branch/role that requires geo-lock
        if (user.branch && geoCheckRequiredRoles.includes(user.role)) {
          try {
            // Re-fetch or reuse geoSettings if needed, but we already have it from Step 1 potentially.
            // However, to keep it clean and robust, we can just fetch it again or pass it down.
            // Let's fetch again for simplicity in this hook structure unless we refactor more.
            const geoSettingsResult = await req.payload.findGlobal({
              slug: 'branch-geo-settings' as any,
            })
            const geoSettings = geoSettingsResult as any

            if (geoSettings?.locations) {
              const userBranchId =
                typeof user.branch === 'string' ? user.branch : (user.branch as { id: string }).id

              const branchGeo = geoSettings.locations.find((loc: any) => {
                const locBranchId = typeof loc.branch === 'string' ? loc.branch : loc.branch?.id
                return locBranchId === userBranchId
              })

              if (branchGeo) {
                const { latitude: targetLat, longitude: targetLon, radius } = branchGeo

                // Only check if coordinates are configured
                if (targetLat !== undefined && targetLon !== undefined) {
                  const headerLat = req.headers.get('x-latitude')
                  const headerLon = req.headers.get('x-longitude')

                  if (headerLat && headerLon) {
                    const userLat = parseFloat(headerLat)
                    const userLon = parseFloat(headerLon)

                    if (!isNaN(userLat) && !isNaN(userLon)) {
                      const distance = getDistanceFromLatLonInMeters(
                        userLat,
                        userLon,
                        targetLat,
                        targetLon,
                      )
                      const allowedRadius = radius || 100

                      if (distance <= allowedRadius) {
                        isGeoAuthorized = true
                        console.log(
                          `Login authorized by Geo-location. Distance: ${distance.toFixed(2)}m`,
                        )
                      } else {
                        console.warn(`Geo Check Failed: Distance ${distance}m > ${allowedRadius}m`)
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('Geo Check Error:', error)
          }
        }

        // If Geo is good, we are done
        if (isGeoAuthorized) return

        // --- 3. Final Decision ---
        // If we are here, it means:
        // 1. IP Check failed (or didn't run effectively but restriction exists).
        // 2. Geo Check failed (or didn't run effectively but might be required).

        // If the user role WAS restricted by IP, and IP failed, AND Geo failed (or wasn't setup), DENY.
        // If the user role WAS NOT restricted by IP (isIpAuthorized was true), we returned early.
        // So we only reach here if isIpAuthorized is false (meaning restriction existed and failed).

        // Construct error message depending on what failed
        if (isIpRestrictedRole || (geoCheckRequiredRoles.includes(user.role) && user.branch)) {
          throw new Error(
            'Login Failed: You must be connected to the Branch WiFi OR be at the shop location (GPS enabled).',
          )
        }
      },
    ],
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation === 'create' || operation === 'update') {
          // Auto-populate name from employee if not set
          if (!data.name && data.employee) {
            const employeeId = typeof data.employee === 'string' ? data.employee : data.employee.id
            if (employeeId) {
              const employee = await req.payload.findByID({
                collection: 'employees',
                id: employeeId,
              })
              if (employee?.name) {
                data.name = employee.name
              }
            }
          }
          if (['branch', 'kitchen'].includes(data.role) && !data.branch) {
            throw new Error('Branch is required for branch or kitchen role users')
          }
          if (data.role === 'company' && !data.company) {
            throw new Error('Company is required for company role users')
          }
          if (
            data.role === 'factory' &&
            (!data.factory_companies || data.factory_companies.length === 0)
          ) {
            throw new Error('At least one company is required for factory role users')
          }
          if (
            ['waiter', 'cashier', 'supervisor', 'delivery', 'driver', 'chef'].includes(data.role) &&
            !data.employee
          ) {
            throw new Error(
              'Employee is required for waiter, cashier, supervisor, delivery, driver, or chef role users',
            )
          }
        }
        return data
      },
    ],
  },
}
