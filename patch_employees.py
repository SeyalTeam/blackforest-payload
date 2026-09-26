import re

with open('src/collections/Employees.ts', 'r') as f:
    text = f.read()

target = """    {
      name: 'phoneNumber',
      type: 'text',
      required: true,
    },"""

replacement = """    {
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
    {
      name: 'phoneNumber',
      type: 'text',
      required: true,
    },"""

if target in text:
    text = text.replace(target, replacement)
    with open('src/collections/Employees.ts', 'w') as f:
        f.write(text)
    print("Success")
else:
    print("Failed")
