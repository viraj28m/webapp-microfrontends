#!/usr/bin/env bash
# Captures a full behavioural snapshot of the workspace into tools/compare/snapshots/<label>.
#
#   tools/compare/capture.sh baseline          # before a migration step
#   tools/compare/capture.sh after-ng18        # after
#   node tools/compare/compare.js tools/compare/snapshots/baseline tools/compare/snapshots/after-ng18
#
# Steps: build the three projects, run unit tests (optional, SKIP_TESTS=1 to skip),
# take a static inventory, then drive the built app with puppeteer against a mocked API.
set -u
cd "$(dirname "$0")/../.."

LABEL="${1:-current}"
OUT="tools/compare/snapshots/$LABEL"
mkdir -p "$OUT"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
export CHROME_BIN="${CHROME_BIN:-$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)}"

BUILD_JSON="$OUT/build.json"
echo '{' > "$BUILD_JSON"

record() { # name status summary
  printf '  "%s": {"status": "%s", "summary": %s},\n' "$1" "$2" "$(node -e 'console.log(JSON.stringify(process.argv[1]))' "$3")" >> "$BUILD_JSON"
}

run_build() { # name ng-args...
  local name="$1"; shift
  echo "== build $name"
  if npx ng build "$@" > "$OUT/build-$name.log" 2>&1; then
    record "build:$name" ok "$(grep -E 'Build at|Application bundle generation complete|Built' "$OUT/build-$name.log" | tail -1)"
  else
    record "build:$name" failed "$(grep -cE 'error (NG|TS)[0-9]+' "$OUT/build-$name.log") compiler errors"
  fi
}

run_test() { # name project
  local name="$1" project="$2"
  echo "== test $name"
  if npx ng test "$project" --watch=false --browsers=ChromeHeadlessNoSandbox --reporters=progress > "$OUT/test-$name.log" 2>&1; then
    record "test:$name" ok "$(grep -E 'Executed [0-9]+ of [0-9]+' "$OUT/test-$name.log" | tail -1 | sed 's/.*Executed/Executed/')"
  else
    local summary
    summary="$(grep -E 'Executed [0-9]+ of [0-9]+' "$OUT/test-$name.log" | tail -1 | sed 's/.*Executed/Executed/')"
    record "test:$name" failed "${summary:-did not run}"
  fi
}

run_build fineract-client fineract-client
run_build mifosx-lib mifosx-lib
run_build mifosx-app mifosx-app --configuration development

if [ "${SKIP_TESTS:-0}" != "1" ]; then
  run_test mifosx-lib mifosx-lib
  run_test mifosx-app mifosx-app
fi

record "meta" ok "angular/core $(node -p "require('./node_modules/@angular/core/package.json').version"), node $(node -v)"
# close JSON (strip trailing comma)
sed -i '$ s/,$//' "$BUILD_JSON"
echo '}' >> "$BUILD_JSON"

echo "== inventory"
node tools/compare/inventory.js "$OUT/inventory.json"

echo "== runtime capture"
node tools/compare/capture.js "$OUT" --dist dist/mifosx-app || echo "(some runtime scenarios failed — see $OUT/runtime.json)"

echo
echo "Snapshot written to $OUT"
cat "$BUILD_JSON"
