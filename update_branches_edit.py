import re
filepath = r'c:\Akash\companyUser\frontend\src\app\(app)\branches\[id]\edit\page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

new_content = content.replace(
    'className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"',
    'className="select-beautiful !w-full !py-2"'
)

if new_content != content:
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Updated branches edit')
