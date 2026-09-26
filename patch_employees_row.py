import re

with open('src/collections/Employees.ts', 'r') as f:
    text = f.read()

# First, remove the existing workingHours field
working_hours_field = """    {
      name: 'workingHours',
      type: 'number',
      required: false,
      admin: {
        description: 'Working hours for the employee',
      },
    },
"""
if working_hours_field in text:
    text = text.replace(working_hours_field, "")

# Now replace the loginTime row with a 3-field row
old_row = """    {
      type: 'row',
      fields: [
        {
          name: 'loginTime',
          type: 'text',
          label: 'Login Time (HH:mm)',
          required: false,
        },
        {
          name: 'logoutTime',
          type: 'text',
          label: 'Logout Time (HH:mm)',
          required: false,
        },
      ],
    },"""

new_row = """    {
      type: 'row',
      fields: [
        {
          name: 'loginTime',
          type: 'text',
          label: 'Login Time (HH:mm)',
          required: false,
          admin: { width: '33%' }
        },
        {
          name: 'logoutTime',
          type: 'text',
          label: 'Logout Time (HH:mm)',
          required: false,
          admin: { width: '33%' }
        },
        {
          name: 'workingHours',
          type: 'number',
          label: 'Working Hours',
          required: false,
          admin: { 
            width: '33%',
            description: 'E.g. 9',
          }
        },
      ],
    },"""

if old_row in text:
    text = text.replace(old_row, new_row)
    with open('src/collections/Employees.ts', 'w') as f:
        f.write(text)
    print("Success")
else:
    print("Failed")

