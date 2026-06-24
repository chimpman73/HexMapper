with open('backend/tests/run_report.py', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if 'print_row(' in line and ('Cliffs' in line or 'Roads' in line or 'Unknowns' in line):
        if i < 220:
            continue
    if 'output_lines.append("=" * len(header)' in line and i < 220:
        continue
    new_lines.append(line)

with open('backend/tests/run_report.py', 'w') as f:
    f.writelines(new_lines)
