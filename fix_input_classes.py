filepath = r'c:\Akash\companyUser\frontend\src\app\(app)\branches\[id]\edit\page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

new_content = content.replace(
    'className="select-beautiful !w-full !py-2"',
    'className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50"'
)

if new_content != content:
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Fixed input classes in branches edit')
