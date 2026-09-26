import re

with open('src/collections/Attendance.ts', 'r') as f:
    text = f.read()

# 1. Add isLate field
is_late_field = """    {
      name: 'isLate',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Auto-calculated: true if the first punch-in is after the employee\\'s configured loginTime.',
      },
    },"""

if "name: 'isLate'" not in text:
    target_field = """    {
      name: 'dayType',"""
    replacement_field = is_late_field + "\n\n" + target_field
    text = text.replace(target_field, replacement_field)

# 2. Add isLate hook logic
hook_logic = """
        // Calculate isLate
        if (data.activities && Array.isArray(data.activities) && data.user) {
          const sessions = data.activities.filter((a: any) => a.type === 'session');
          if (sessions.length > 0) {
            const firstSession = [...sessions].sort((a, b) => new Date(a.punchIn).getTime() - new Date(b.punchIn).getTime())[0];
            if (firstSession && firstSession.punchIn) {
              try {
                let employeeId = data.employee;
                if (!employeeId) {
                  const userRes = await req.payload.findByID({ collection: 'users', id: typeof data.user === 'string' ? data.user : data.user.id });
                  if (userRes && userRes.employee) {
                    employeeId = typeof userRes.employee === 'string' ? userRes.employee : userRes.employee.id;
                  }
                } else {
                  employeeId = typeof employeeId === 'string' ? employeeId : employeeId.id;
                }
                
                if (employeeId) {
                  const employeeRes = await req.payload.findByID({ collection: 'employees', id: employeeId });
                  if (employeeRes && employeeRes.loginTime) {
                    const punchInDate = new Date(firstSession.punchIn);
                    const istTime = new Date(punchInDate.getTime() + (5.5 * 60 * 60 * 1000));
                    const hours = istTime.getUTCHours();
                    const minutes = istTime.getUTCMinutes();
                    
                    const timeParts = employeeRes.loginTime.split(':');
                    if (timeParts.length >= 2) {
                      const loginStrH = parseInt(timeParts[0], 10);
                      const loginStrM = parseInt(timeParts[1], 10);
                      
                      if (!isNaN(loginStrH) && !isNaN(loginStrM)) {
                        if (hours > loginStrH || (hours === loginStrH && minutes > loginStrM)) {
                          data.isLate = true;
                        } else {
                          data.isLate = false;
                        }
                      }
                    }
                  }
                }
              } catch(e) {
                 req.payload.logger.error({ err: e, msg: 'Error calculating isLate' });
              }
            }
          }
        }

        return data;"""

if "return data;" in text and "Calculate isLate" not in text:
    text = text.replace("        return data;", hook_logic)

with open('src/collections/Attendance.ts', 'w') as f:
    f.write(text)
    
print("Success")
