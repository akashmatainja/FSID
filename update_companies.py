import re
filepath = r'c:\Akash\companyUser\frontend\src\app\(app)\companies\page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

new_content = content

# First replace
new_content = new_content.replace(
    'className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-border/60 bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50"',
    'className="select-beautiful !w-full"'
)

# Second replace
new_content = new_content.replace(
    'className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/50 cursor-pointer"',
    'className="select-beautiful !w-full"'
)

if new_content != content:
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Updated companies')
