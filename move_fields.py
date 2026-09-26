import re

with open('src/collections/Employees.ts', 'r') as f:
    text = f.read()

# First, remove the login/logout block from its current place
login_block = """    {
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
    },
"""

if login_block in text:
    text = text.replace(login_block, "")
else:
    print("Could not find login block")
    
working_hours_block = """    {
      name: 'workingHours',
      type: 'number',
      required: false,
      admin: {
        description: 'Working hours for the employee',
      },
    },"""
    
if working_hours_block in text:
    text = text.replace(working_hours_block, working_hours_block + "\n" + login_block.rstrip('\n'))
    with open('src/collections/Employees.ts', 'w') as f:
        f.write(text)
    print("Success")
else:
    print("Could not find working hours block")
