#!/usr/bin/env bash
# Постобработка компонентов, установленных из реестра ReUI/shadcn.
#
# Генератор подставляет `import { cn } from "cn"` — он считает cn пакетом,
# потому что реестр объявляет его в dependencies. Пакета с таким именем нет,
# и сборка падает на TS2307. Правим на наш алиас.
#
# Запускать после каждого `npx shadcn add`.
set -euo pipefail
dir="${1:-components/reui}"
changed=0
while IFS= read -r f; do
  if grep -q 'from "cn"' "$f"; then
    sed -i '' 's|from "cn"|from "@/lib/utils"|g' "$f"
    echo "  исправлен: $f"
    changed=$((changed+1))
  fi
done < <(find "$dir" -name '*.tsx' -o -name '*.ts' 2>/dev/null)
echo "Файлов исправлено: $changed"
