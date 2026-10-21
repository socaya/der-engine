from pathlib import Path
import csv
root=Path(__file__).resolve().parents[1]
required=['README.md','server/pom.xml','server/src/main/java/ug/ac/mak/der/DerApplication.java','admin-ui/package.json','client/package.json','deployment/systemd/der.service.example','docs/requirements/screen-inventory.csv']
missing=[path for path in required if not (root/path).is_file()]
with (root/'docs/requirements/screen-inventory.csv').open(newline='') as stream: screens=list(csv.DictReader(stream))
assert not missing, f'Missing files: {missing}'
assert len(screens)==54, f'Expected 54 screen specifications, got {len(screens)}'
print(f'Structure OK: {len(required)} critical files; {len(screens)} planned screens. Runtime features require real testing.')
