import os

with open('backend/layer_assembler.py', 'r') as f:
    lines = f.readlines()

out = []
in_loop = False
for l in lines:
    if 'for path_points in data.global_borders:' in l:
        in_loop = True
        out.append(l)
    elif in_loop:
        if l.strip() == '':
            out.append(l)
        elif '        # Convert global cliffs' in l:
            in_loop = False
            out.append(l)
        else:
            # check number of leading spaces
            spaces = len(l) - len(l.lstrip())
            if spaces >= 20:
                out.append(l[4:])
            else:
                out.append(l)
    else:
        out.append(l)

with open('backend/layer_assembler.py', 'w') as f:
    f.writelines(out)
