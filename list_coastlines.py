import sys
import os
sys.path.append('backend')
from template_manager import TemplateManager

tm = TemplateManager(os.getcwd())
for t in tm.templates['coastline']:
    print(f"{t['key']} - color: {t.get('mean_color')}")
