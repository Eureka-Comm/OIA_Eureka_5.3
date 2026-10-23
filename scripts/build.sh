#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
dist_root="$project_root/dist"

rm -rf "$dist_root"
mkdir -p "$dist_root/server"
cp -R "$project_root/worker/." "$dist_root/server/"

echo "Built $dist_root"
