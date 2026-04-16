import re, os

pages = [
    r'c:\Akash\companyUser\frontend\src\app\(app)\branches\page.tsx',
    r'c:\Akash\companyUser\frontend\src\app\(app)\subdivisions\page.tsx',
    r'c:\Akash\companyUser\frontend\src\app\(app)\machines\page.tsx',
    r'c:\Akash\companyUser\frontend\src\app\(app)\users\page.tsx',
    r'c:\Akash\companyUser\frontend\src\app\(app)\assignments\page.tsx',
    r'c:\Akash\companyUser\frontend\src\app\(app)\roles\page.tsx',
    r'c:\Akash\companyUser\frontend\src\app\(app)\dashboard\page.tsx',
]

import_line = 'import CustomSelect from "@/components/ui/CustomSelect";'

for path in pages:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    # Add import if not present
    if 'CustomSelect' not in content:
        content = content.replace(
            'import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";',
            'import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";\n' + import_line
        )
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Added import to ' + path)
    else:
        print('Already has import: ' + path)
