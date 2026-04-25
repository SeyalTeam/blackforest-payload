import type { CollectionConfig } from 'payload'
import { isIPAllowed } from '../utilities/ipCheck'
import { getDistanceFromLatLonInMeters } from '../utilities/geo'
import type { IpSetting } from '../payload-types'
import {
  BRANCH_PIN_HEADER,
  BRANCH_PIN_REQUIRED_ROLES,
  isValidBranchPin,
  normalizeBranchPin,
} from '../utilities/branchPins'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role', 'loginBlocked'],
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
      type: 'row',
      fields: [
        {
          name: 'isKitchen',
          label: 'Kitchen',
          type: 'checkbox',
          defaultValue: false,
          access: {
            create: ({ req }) => req.user?.role === 'superadmin',
            update: ({ req }) => req.user?.role === 'superadmin',
          },
        },
        {
          name: 'isStock',
          label: 'Stock',
          type: 'checkbox',
          defaultValue: false,
          access: {
            create: ({ req }) => req.user?.role === 'superadmin',
            update: ({ req }) => req.user?.role === 'superadmin',
          },
        },
      ],
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: false,
      admin: {
        condition: ({ role, isKitchen }) =>
          ['branch', 'kitchen'].includes(role) && !Boolean(isKitchen),
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin',
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    {
      name: 'kitchenBranches',
      label: 'Kitchen Branches',
      type: 'relationship',
      relationTo: 'branches',
      hasMany: true,
      required: false,
      admin: {
        condition: ({ isKitchen }) => Boolean(isKitchen),
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
        // If "Kitchen" checkbox is enabled, user is scoped to ALL kitchens in selected branch.
        condition: ({ role, isKitchen }) => role === 'kitchen' && !Boolean(isKitchen),
      },
      filterOptions: ({ data }) => {
        if (data?.branch) {
          return {
            branches: {
              contains: typeof data.branch === 'object' ? data.branch.id : data.branch,
            },
          }
        }
        return true
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
    {
      name: 'forceLogoutAllDevices',
      type: 'checkbox',
      defaultValue: false,
      saveToJWT: false,
      admin: {
        description:
          'Enable and save to force logout this user from all devices. The value resets after save.',
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin',
        read: ({ req }) => req.user?.role === 'superadmin',
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    {
      name: 'loginBlocked',
      type: 'checkbox',
      defaultValue: false,
      saveToJWT: false,
      admin: {
        description:
          'When enabled, this user cannot login until a superadmin disables this block.',
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin',
        read: ({ req }) => req.user?.role === 'superadmin',
        update: ({ req }) => req.user?.role === 'superadmin',
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
        let deviceId: string | null = null
        if (req.headers && typeof req.headers.get === 'function') {
          deviceId = req.headers.get('x-device-id')
        }
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
          console.log(
            `[Session] User ${user.email} (${user.role}) logged in. Standard 14h intended.`,
          )

          // Log Attendance Daily Log (Punch In)
          try {
            const now = new Date()

            // Detect Private IP (sent from mobile app header)
            const privateIpHeader = req.headers.get('x-private-ip')
            const privateIp =
              typeof privateIpHeader === 'string' ? privateIpHeader.trim() : 'Unknown'

            // Get IST Date string (YYYY-MM-DD)
            const istDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
            const localStartOfDay = new Date(istDateStr + 'T00:00:00Z') // Normalized for DB date field

            // 1. Find or Create today's attendance document by dateString
            const latHeader = req.headers.get('x-latitude')
            const lngHeader = req.headers.get('x-longitude')
            const lat = latHeader ? parseFloat(latHeader) : null
            const lng = lngHeader ? parseFloat(lngHeader) : null

            const existingLogs = await req.payload.find({
              collection: 'attendance',
              where: {
                user: { equals: user.id },
                dateString: { equals: istDateStr },
              },
              depth: 0,
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
                  ipAddress: privateIp,
                  device: deviceId || 'Unknown',
                  location: {
                    latitude: lat,
                    longitude: lng,
                  },
                } as any,
              })
            }

            const activities = [...(attendanceDoc.activities || [])]

            // 2. DUPLICATE PREVENTION: Check if already punched in
            const lastActivity = activities.length > 0 ? activities[activities.length - 1] : null
            if (
              lastActivity &&
              lastActivity.type === 'session' &&
              lastActivity.status === 'active'
            ) {
              console.log(
                `[Attendance] User ${user.email} already has an ACTIVE session in Daily Log. Skipping.`,
              )
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
                  ipAddress: privateIp,
                  device: deviceId || 'Unknown',
                })
              }
            }

            // 4. Append NEW Session activity
            activities.push({
              type: 'session',
              punchIn: now.toISOString(),
              status: 'active',
              ipAddress: privateIp,
              device: deviceId || 'Unknown',
              latitude: lat,
              longitude: lng,
            } as any)

            await req.payload.update({
              collection: 'attendance',
              id: attendanceDoc.id,
              data: {
                activities: activities as any,
                ipAddress: privateIp,
                device: deviceId || 'Unknown',
                location: {
                  latitude: lat,
                  longitude: lng,
                },
              },
            })

            console.log(`[Attendance] Managed IST Daily Log (${istDateStr}) for ${user.email}`)
          } catch (e) {
            console.error(`[Attendance] Failed to manage Daily Log for ${user.email}:`, e)
          }
        } else {
          console.log(
            `[Session] User ${user.email} (${user.role}) logged in. Extended 30d session allowed.`,
          )
        }
      },
    ],
    beforeLogin: [
      async ({ req, user }) => {
        const isLoginBlocked = Boolean(
          (user as { loginBlocked?: boolean | null }).loginBlocked,
        )
        if (isLoginBlocked) {
          throw new Error('Login blocked by superadmin. Please contact administrator.')
        }

        if (user.role === 'superadmin') return

        const getRelationshipID = (value: unknown): string | null => {
          if (!value) return null
          if (typeof value === 'string') return value
          if (typeof value === 'object' && value !== null && 'id' in value) {
            const id = (value as { id?: unknown }).id
            return typeof id === 'string' ? id : null
          }
          return null
        }

        const staffBranchPinRoles = Array.from(BRANCH_PIN_REQUIRED_ROLES)
        const strictBranchAssignmentRoles = ['branch']

        const requestBody = (req as { body?: unknown } | undefined)?.body
        const rawBranchPinFromBody =
          requestBody && typeof requestBody === 'object' && requestBody !== null
            ? (requestBody as { branchPin?: unknown }).branchPin
            : null
        const branchPinFromBody = normalizeBranchPin(rawBranchPinFromBody)

        let branchPinFromHeader: string | null = null
        let branchPinFromLegacyHeader: string | null = null
        if (req.headers && typeof req.headers.get === 'function') {
          branchPinFromHeader = normalizeBranchPin(req.headers.get(BRANCH_PIN_HEADER))
          branchPinFromLegacyHeader = normalizeBranchPin(req.headers.get('x-branch-code'))
        }

        const branchPin = branchPinFromHeader || branchPinFromLegacyHeader || branchPinFromBody
        const isBranchPinRequired = BRANCH_PIN_REQUIRED_ROLES.has(user.role)
        const hasAnyBranchPinInput = Boolean(
          branchPinFromHeader || branchPinFromLegacyHeader || branchPinFromBody,
        )

        if (hasAnyBranchPinInput && (!branchPin || !isValidBranchPin(branchPin))) {
          throw new Error('Branch PIN must be exactly 4 digits.')
        }

        if (isBranchPinRequired && !branchPin) {
          throw new Error(`Branch PIN is required. Send ${BRANCH_PIN_HEADER} in the login request.`)
        }

        let pinMatchedBranch: { id: string; name?: string } | null | undefined

        const resolveBranchByPin = async () => {
          if (!branchPin || !isValidBranchPin(branchPin)) return null
          if (pinMatchedBranch !== undefined) return pinMatchedBranch

          console.log(`[Login Debug] Resolving branch for PIN: ${branchPin}`)
          const branchResult = await req.payload.find({
            collection: 'branches',
            where: {
              branchPin: {
                equals: branchPin,
              },
            },
            limit: 2,
            depth: 0,
            overrideAccess: true,
          })

          const matchedBranch = branchResult.docs[0]
          if (matchedBranch) {
            console.log(`[Login Debug] PIN ${branchPin} matched branch: ${matchedBranch.name} (${matchedBranch.id})`)
          } else {
            console.warn(`[Login Debug] PIN ${branchPin} matched NO branches.`)
          }
          pinMatchedBranch = matchedBranch
            ? { id: String(matchedBranch.id), name: (matchedBranch as any).name }
            : null
          return pinMatchedBranch
        }

        const attachBranchToUser = async (branchID: string) => {
          // Keep branch in login context only. Do not persist waiter/cashier-style users to one branch.
          ;(user as { branch?: unknown }).branch = branchID
        }

        // Branch PIN can set the branch context before network checks (useful for waiter logins).
        if (branchPin && staffBranchPinRoles.includes(user.role)) {
          try {
            const matchedBranch = await resolveBranchByPin()
            if (!matchedBranch) {
              if (isBranchPinRequired) {
                throw new Error('Invalid Branch PIN.')
              }
            } else {
              const userBranchID = getRelationshipID(user.branch)
              const enforceBranchMatch = strictBranchAssignmentRoles.includes(user.role)
              if (enforceBranchMatch && userBranchID && userBranchID !== matchedBranch.id) {
                throw new Error('Branch PIN does not match your assigned branch.')
              }

              await attachBranchToUser(matchedBranch.id)
              console.log(
                `[Login Debug] Branch resolved via PIN for ${user.email}: ${matchedBranch.name || matchedBranch.id}`,
              )
            }
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === 'Branch PIN does not match your assigned branch.'
            ) {
              throw error
            }
            console.error('[Login Debug] Branch PIN pre-check error:', error)
          }
        }

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
          let forwarded: string | null = null
          let privateIpHeader: string | null = null
          if (req.headers && typeof req.headers.get === 'function') {
            forwarded = req.headers.get('x-forwarded-for')
            privateIpHeader = req.headers.get('x-private-ip')
          }

          const publicIp =
            typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '127.0.0.1'
          const privateIp = typeof privateIpHeader === 'string' ? privateIpHeader.trim() : null

          if (user.branch) {
            const userBranchId = String(
              typeof user.branch === 'string' ? user.branch : (user.branch as { id: string }).id,
            )
            console.log(`[Login Debug] User Branch ID: ${userBranchId}, Public IP: ${publicIp}`)

            // A. Check Branch-specific IP from BranchGeoSettings (New)
            if (geoSettings?.locations) {
              const branchGeo = geoSettings.locations.find((loc: any) => {
                const locBranchId = String(
                  (typeof loc.branch === 'string' ? loc.branch : loc.branch?.id) || '',
                )
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
        if (isIpAuthorized) {
          console.log(`[Login Success] Authorized by IP for ${user.email}`)
          return
        }

        // --- 2. Geo Location Check (Fallback) ---
        let isGeoAuthorized = false

        const geoCheckRequiredRoles = ['branch', 'kitchen', 'cashier', 'waiter', 'supervisor']

        // Check if user has a branch/role that requires geo-lock
        if (user.branch && geoCheckRequiredRoles.includes(user.role)) {
          try {
            const geoSettingsResult = await req.payload.findGlobal({
              slug: 'branch-geo-settings' as any,
            })
            const geoSettings = geoSettingsResult as any

            if (geoSettings?.locations) {
              const userBranchId = String(
                typeof user.branch === 'string' ? user.branch : (user.branch as { id: string }).id,
              )

              const branchGeo = geoSettings.locations.find((loc: any) => {
                const locBranchId = String(
                  (typeof loc.branch === 'string' ? loc.branch : loc.branch?.id) || '',
                )
                return locBranchId === userBranchId
              })

              if (branchGeo) {
                const { latitude: targetLat, longitude: targetLon, radius } = branchGeo

                // Only check if coordinates are configured
                if (targetLat !== undefined && targetLon !== undefined) {
                  let headerLat: string | null = null
                  let headerLon: string | null = null
                  if (req.headers && typeof req.headers.get === 'function') {
                    headerLat = req.headers.get('x-latitude')
                    headerLon = req.headers.get('x-longitude')
                  }

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
                          `[Login Success] Authorized by Geo-location for ${user.email}. Distance: ${distance.toFixed(2)}m`,
                        )
                      } else {
                        console.warn(
                          `[Login Debug] Geo Check Failed for ${user.email}: Distance ${distance.toFixed(2)}m > ${allowedRadius}m`,
                        )
                      }
                    } else {
                      console.warn(
                        `[Login Debug] Geo Check Skipped for ${user.email}: Invalid coordinates in headers (${headerLat}, ${headerLon})`,
                      )
                    }
                  } else {
                    console.warn(
                      `[Login Debug] Geo Check Skipped for ${user.email}: No GPS headers provided.`,
                    )
                  }
                } else {
                  console.warn(
                    `[Login Debug] Geo Check Skipped for ${user.email}: Branch ${userBranchId} has no coordinates configured in Geo Settings.`,
                  )
                }
              } else {
                console.warn(
                  `[Login Debug] Geo Check Skipped for ${user.email}: Branch ${userBranchId} not found in Geo Settings locations.`,
                )
              }
            }
          } catch (error) {
            console.error('[Login Debug] Geo Check Error:', error)
          }
        }

        // If Geo is good, we are done
        if (isGeoAuthorized) return

        // --- 3. Branch PIN Fallback ---
        if (branchPin && staffBranchPinRoles.includes(user.role)) {
          try {
            const matchedBranch = await resolveBranchByPin()
            if (matchedBranch) {
              const userBranchID = getRelationshipID(user.branch)
              const enforceBranchMatch = strictBranchAssignmentRoles.includes(user.role)
              if (enforceBranchMatch && userBranchID && userBranchID !== matchedBranch.id) {
                console.warn(
                  `[Login Debug] PIN Fallback Failed for ${user.email}: PIN matches branch ${matchedBranch.id} but user is assigned to ${userBranchID}`,
                )
                throw new Error('Branch PIN does not match your assigned branch.')
              }

              await attachBranchToUser(matchedBranch.id)
              console.log(
                `[Login Success] Authorized by Branch PIN fallback for ${user.email} (Branch: ${matchedBranch.name || matchedBranch.id})`,
              )
              return
            }
            console.warn(
              `[Login Debug] PIN Fallback Failed for ${user.email}: Entered PIN ${branchPin} matched no branches.`,
            )
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === 'Branch PIN does not match your assigned branch.'
            ) {
              throw error
            }
            console.error('[Login Debug] Branch PIN fallback error:', error)
          }
        }

        // --- 4. Final Decision ---
        console.warn(
          `[Login Denied] ${user.email} failed all checks. IP Authorized: ${isIpAuthorized}, Geo Authorized: ${isGeoAuthorized}, PIN provided: ${Boolean(branchPin)}`,
        )

        // Construct error message depending on what failed
        if (isIpRestrictedRole || (geoCheckRequiredRoles.includes(user.role) && user.branch)) {
          throw new Error(
            'Login Failed: You must be connected to Branch WiFi, be at the shop location (GPS enabled), or provide a valid 4-digit Branch PIN.',
          )
        }
      },
    ],
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        const nextData = data as typeof data & {
          forceLogoutAllDevices?: boolean
          loginBlocked?: boolean
          password?: string
          sessions?: unknown[]
          deviceId?: null | string
          role?: string
          branch?: unknown
          kitchen?: unknown
          kitchenBranches?: unknown[]
          company?: unknown
          factory_companies?: unknown[]
          employee?: unknown
          isKitchen?: boolean | null
        }

        const isPasswordChange =
          operation === 'update' &&
          typeof nextData.password === 'string' &&
          nextData.password.trim().length > 0

        const isForceLogoutRequested =
          operation === 'update' &&
          req.user?.role === 'superadmin' &&
          nextData.forceLogoutAllDevices === true

        if (isPasswordChange || isForceLogoutRequested) {
          nextData.sessions = []
          nextData.deviceId = null
        }

        if (isForceLogoutRequested) {
          nextData.forceLogoutAllDevices = false
          nextData.loginBlocked = true
        }

        if (operation === 'create' || operation === 'update') {
          // Auto-populate name from employee if not set
          if (!nextData.name && nextData.employee) {
            const employeeId =
              typeof nextData.employee === 'string'
                ? nextData.employee
                : typeof nextData.employee === 'object' &&
                    nextData.employee !== null &&
                    'id' in nextData.employee
                  ? nextData.employee.id
                  : undefined
            if (typeof employeeId === 'string' && employeeId.length > 0) {
              const employee = await req.payload.findByID({
                collection: 'employees',
                id: employeeId,
              })
              if (employee?.name) {
                nextData.name = employee.name
              }
            }
          }
          const resolvedRole =
            nextData.role ||
            ((operation === 'update'
              ? (originalDoc as { role?: string } | undefined)?.role
              : undefined) ??
              '')
          const resolvedBranch =
            nextData.branch ??
            (operation === 'update'
              ? (originalDoc as { branch?: unknown } | undefined)?.branch
              : undefined)
          const resolvedKitchenBranches =
            nextData.kitchenBranches ??
            (operation === 'update'
              ? (originalDoc as { kitchenBranches?: unknown[] } | undefined)?.kitchenBranches
              : undefined)
          const resolvedKitchenFlag =
            typeof nextData.isKitchen === 'boolean'
              ? nextData.isKitchen
              : Boolean(
                  operation === 'update'
                    ? (originalDoc as { isKitchen?: boolean | null } | undefined)?.isKitchen
                    : false,
                )

          if (
            ['branch', 'kitchen'].includes(resolvedRole) &&
            !resolvedKitchenFlag &&
            !resolvedBranch
          ) {
            throw new Error('Branch is required for branch or kitchen role users')
          }

          if (resolvedKitchenFlag) {
            if (!Array.isArray(resolvedKitchenBranches) || resolvedKitchenBranches.length === 0) {
              throw new Error('At least one Kitchen Branch is required when Kitchen checkbox is enabled')
            }
            nextData.branch = null
            // Branch-level kitchen access should not be tied to one specific kitchen.
            nextData.kitchen = null
          }
          if (nextData.role === 'company' && !nextData.company) {
            throw new Error('Company is required for company role users')
          }
          if (
            nextData.role === 'factory' &&
            (!nextData.factory_companies || nextData.factory_companies.length === 0)
          ) {
            throw new Error('At least one company is required for factory role users')
          }
          if (
            typeof nextData.role === 'string' &&
            ['waiter', 'cashier', 'supervisor', 'delivery', 'driver', 'chef'].includes(
              nextData.role,
            ) &&
            !nextData.employee
          ) {
            throw new Error(
              'Employee is required for waiter, cashier, supervisor, delivery, driver, or chef role users',
            )
          }
        }
        return nextData
      },
    ],
  },
}
