import os, re

target_dir = r'c:\Akash\companyUser\frontend\src\app\(app)'

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content
    
    # 1. w-full pl-11 ...
    new_content = re.sub(
        r'w-full pl-11 pr-10 py-[0-9.]+ rounded-[^ ]+ border bg-card/50 text-sm font-medium(?: text-foreground)? focus:outline-none focus:ring-2 appearance-none cursor-pointer transition-all',
        r'select-beautiful pl-11',
        new_content
    )
    
    # 2. w-full px-4 ...
    new_content = re.sub(
        r'w-full px-4 py-[0-9.]+ rounded-[^ ]+ border bg-card/50 text-sm font-medium(?: text-foreground)? focus:outline-none focus:ring-2 appearance-none cursor-pointer transition-all',
        r'select-beautiful',
        new_content
    )

    # 3. w-full pl-4 ... (machines page status select)
    new_content = re.sub(
        r'w-full pl-4 pr-10 py-[0-9.]+ rounded-[^ ]+ border border-border/60 bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-[^ ]+ focus:border-brand-[^ ]+ appearance-none cursor-pointer transition-all',
        r'select-beautiful',
        new_content
    )

    # 4. branches edit page
    new_content = re.sub(
        r'w-full pl-11 pr-4 py-3 rounded-xl border bg-card/50 text-sm font-medium text-foreground focus:outline-none focus:ring-2 appearance-none cursor-pointer transition-all',
        r'select-beautiful pl-11 pr-10',
        new_content
    )

    # 5. users page status select
    new_content = re.sub(
        r'w-full pl-4 pr-10 py-3 rounded-xl border border-border/50 bg-card/50 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand-[^ ]+ focus:border-brand-[^ ]+ appearance-none cursor-pointer transition-all',
        r'select-beautiful',
        new_content
    )
    
    # 6. assignments page user and machine selects
    new_content = re.sub(
        r'w-full px-4 py-3 rounded-xl border border-border/50 bg-card/50 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer transition-all',
        r'select-beautiful',
        new_content
    )

    # 7. general simple ones
    new_content = re.sub(
        r'w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-[0-9]+',
        r'select-beautiful !py-2',
        new_content
    )

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print('Updated ' + filepath)

for root, _, files in os.walk(target_dir):
    for f in files:
        if f.endswith('.tsx'):
            process_file(os.path.join(root, f))
