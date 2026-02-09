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
    tokenExpiration: 2592000, // 30 Days (Global max) - We restrict staff to 14h via hooks
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
      name: 'kitchen',
      type: 'relationship',
      relationTo: 'kitchens',
      required: false,
      admin: {
        condition: ({ role }) => role === 'kitchen',
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
          ['waiter', 'cashier', 'supervisor', 'delivery', 'driver', 'chef', 'kitchen'].includes(
            role,
          ),
      },
      filterOptions: ({ siblingData }) => {
        const role = (siblingData as { role?: string }).role
        if (
          !role ||
          !['waiter', 'cashier', 'supervisor', 'delivery', 'driver', 'chef', 'kitchen'].includes(
            role,
          )
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
    {
      name: 'deviceId',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
  ],
  access: {
    create: ({ req }) => req.user?.role === 'superadmin',
    read: ({ req }) => {
      if (!req.user) return false
      return true // Allow all authenticated users to read
    },
    update: ({ req, id }) => {
      if (!req.user) return false
      return req.user.role === 'superadmin' || req.user.id === id
    },
    delete: ({ req }) => req.user?.role === 'superadmin',
  },
  hooks: {
    afterLogin: [
      async ({ req, user }) => {
        const deviceId = req.headers.get('x-device-id')
        if (deviceId && user.id) {
          await req.payload.update({
            collection: 'users',
            id: user.id,
            data: {
              deviceId: deviceId,
            } as any, // Cast to any to bypass type check until types are regenerated
          })
        }

        // --- Session Duration Logic ---
        // Global is set to 30 days (2592000s)
        // If Role is NOT (superadmin, admin, company, factory) -> ideally enforce 14h (50400s)
        const longSessionRoles = ['superadmin', 'admin', 'company', 'factory']
        if (!longSessionRoles.includes(user.role)) {
           console.log(`[Session] User ${user.email} (${user.role}) logged in. Standard 14h intended.`)
           
           // Log Attendance Daily Log (Punch In)
           try {
             const now = new Date()
             
             // Detect Public IP (same logic as beforeLogin)
             const forwarded = req.headers.get('x-forwarded-for')
             const publicIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '127.0.0.1'
             
             // Get IST Date string (YYYY-MM-DD)
             const istDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) 
             const localStartOfDay = new Date(istDateStr + 'T00:00:00Z') // Normalized for DB date field
             
             // 1. Find or Create today's attendance document by dateString
             const existingLogs = await req.payload.find({
               collection: 'attendance',
               where: {
                 user: { equals: user.id },
                 dateString: { equals: istDateStr },
               },
             })

             let attendanceDoc
             if (existingLogs.docs.length > 0) {
               attendanceDoc = existingLogs.docs[0]
             } else {
               attendanceDoc = await req.payload.create({
                 collection: 'attendance',
                 data: {
                   user: user.id,
                   date: localStartOfDay.toISOString(),
                   dateString: istDateStr,
                   activities: [],
                 } as any,
               })
             }

             const activities = [...(attendanceDoc.activities || [])]
             
             // 2. DUPLICATE PREVENTION: Check if already punched in
             const lastActivity = activities.length > 0 ? activities[activities.length - 1] : null
             if (lastActivity && lastActivity.type === 'session' && lastActivity.status === 'active') {
               console.log(`[Attendance] User ${user.email} already has an ACTIVE session in Daily Log. Skipping.`)
               return
             }

             // 3. Check for Break (gap between last punchOut and now)
             if (lastActivity && lastActivity.punchOut) {
               const lastOut = new Date(lastActivity.punchOut)
               const breakSeconds = Math.floor((now.getTime() - lastOut.getTime()) / 1000)
               
               if (breakSeconds >= 30) {
                 activities.push({
                   type: 'break',
                   punchIn: lastOut.toISOString(),
                   punchOut: now.toISOString(),
                   status: 'closed',
                   durationSeconds: breakSeconds,
                   ipAddress: publicIp,
                   device: deviceId || 'Unknown',
                 })
               }
             }

             // 4. Append NEW Session activity
             activities.push({
               type: 'session',
               punchIn: now.toISOString(),
               status: 'active',
               ipAddress: publicIp,
               device: deviceId || 'Unknown',
             })

             await req.payload.update({
               collection: 'attendance',
               id: attendanceDoc.id,
               data: {
                 activities: activities as any,
               },
             })

             console.log(`[Attendance] Managed IST Daily Log (${istDateStr}) for ${user.email}`)
           } catch (e) {
             console.error(`[Attendance] Failed to manage Daily Log for ${user.email}:`, e)
           }

        } else {
           console.log(`[Session] User ${user.email} (${user.role}) logged in. Extended 30d session allowed.`)
        }
      },
    ],
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
            const userBranchId = (
              typeof user.branch === 'string' ? user.branch : (user.branch as { id: string }).id
            ).toString()
            console.log(`[Login Debug] User Branch ID: ${userBranchId}, Public IP: ${publicIp}`)

            // A. Check Branch-specific IP from BranchGeoSettings (New)
            if (geoSettings?.locations) {
              const branchGeo = geoSettings.locations.find((loc: any) => {
                const locBranchId = (
                  typeof loc.branch === 'string' ? loc.branch : loc.branch?.id
                )?.toString()
                return locBranchId === userBranchId
              })

              if (branchGeo?.ipAddress) {
                console.log(
                  `[Login Debug] Found GeoSetting IP config for branch: ${branchGeo.ipAddress}`,
                )
                if (isIPAllowed(publicIp, [branchGeo.ipAddress])) {
                  console.log(`[Login Debug] SUCCESS: Authorized by BranchGeoSettings IP/Range`)
                  isIpAuthorized = true
                }
              } else {
                console.log(`[Login Debug] No GeoSetting IP config found for branch.`)
              }
            }

            // B. Check IP from Branches collection (Previous/legacy)
            if (!isIpAuthorized) {
              const branchDoc = await req.payload.findByID({
                collection: 'branches',
                id: userBranchId,
              })
              if (branchDoc?.ipAddress) {
                console.log(
                  `[Login Debug] Found Branch collection IP config: ${branchDoc.ipAddress}`,
                )
                if (isIPAllowed(publicIp, [branchDoc.ipAddress])) {
                  console.log(`[Login Debug] SUCCESS: Authorized by Branches collection IP/Range`)
                  isIpAuthorized = true
                }
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
              console.log(`[Login Debug] SUCCESS: Authorized by Global Role Restrictions`)
              isIpAuthorized = true
            } else {
              console.warn(
                `[Login Debug] Global IP Check Failed for ${user.role}. Public: ${publicIp}, Private: ${privateIp}`,
              )
            }
          } else if (!restriction && !isIpAuthorized) {
            // No restriction for this role -> default authorized
            console.log(`[Login Debug] SUCCESS: No role restrictions found.`)
            isIpAuthorized = true
          }
        } catch (error) {
          console.error('[Login Debug] IP Check Error:', error)
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
