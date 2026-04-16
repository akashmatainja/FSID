import re, os

def replace_select_block(content, file_hint=""):
    """Replace <select className="select-beautiful..."> blocks with CustomSelect."""
    
    pattern = re.compile(
        r'(<select\b[^>]*?className=\{?["`\'](?:[^"\'`\}]*?\s)?select-beautiful[^"\'`\}]*["`\'\}][^>]*>)(.*?)(</select>)',
        re.DOTALL
    )

    def build_custom(match):
        opening_tag = match.group(1)
        inner = match.group(2)

        # Extract value prop
        value_m = re.search(r'value=\{([^}]+)\}', opening_tag)
        value = value_m.group(1) if value_m else '""'

        # Extract onChange prop
        onchange_m = re.search(r'onChange=\{([^}]+)\}', opening_tag)
        onchange = onchange_m.group(1) if onchange_m else '() => {}'

        # Extract className  
        class_m = re.search(r'className=\{?["`\'](.*?)["`\']\}?', opening_tag)
        extra_class = ''
        if class_m:
            cls = class_m.group(1)
            cls = re.sub(r'select-beautiful\s*', '', cls).strip()
            if cls:
                extra_class = f'\n              className="{cls}"'

        # Extract icon from absolute positioned sibling (pl-11 = has icon)
        has_icon = 'pl-11' in opening_tag

        # Extract options
        option_pattern = re.compile(r'<option\b([^>]*)>(.*?)</option>', re.DOTALL)
        opts = []
        for om in option_pattern.finditer(inner):
            attrs = om.group(1)
            label = om.group(2).strip()
            val_m = re.search(r'value=["\']([^"\']*)["\']', attrs)
            disabled = 'disabled' in attrs
            val = val_m.group(1) if val_m else ''
            opts.append((val, label, disabled))

        if not opts:
            return match.group(0)  # skip if no options found

        opts_str = ',\n              '.join(
            f'{{ value: "{v}", label: "{l}"{", disabled: true" if d else ""} }}'
            for v, l, d in opts
        )

        # Build onChange string
        # If the onchange is an arrow function with e.target.value, replace with v
        new_onchange = re.sub(r'\(e\)\s*=>\s*\{?', '(v) => {', onchange)
        new_onchange = re.sub(r'e\.target\.value', 'v', new_onchange)
        new_onchange = onchange.replace('(e) =>', '(v) =>').replace('e.target.value', 'v')

        result = f'''<CustomSelect
              value={{{value}}}
              onChange={{{new_onchange}}}{extra_class}
              options={{[
              {opts_str}
              ]}}
            />'''
        return result

    new_content = pattern.sub(build_custom, content)
    return new_content

pages = [
    r'c:\Akash\companyUser\frontend\src\app\(app)\branches\page.tsx',
    r'c:\Akash\companyUser\frontend\src\app\(app)\subdivisions\page.tsx',
    r'c:\Akash\companyUser\frontend\src\app\(app)\machines\page.tsx',
    r'c:\Akash\companyUser\frontend\src\app\(app)\users\page.tsx',
    r'c:\Akash\companyUser\frontend\src\app\(app)\assignments\page.tsx',
    r'c:\Akash\companyUser\frontend\src\app\(app)\roles\page.tsx',
]

for path in pages:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    new_content = replace_select_block(content, path)
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Updated: {path}')
    else:
        print(f'No change: {path}')
