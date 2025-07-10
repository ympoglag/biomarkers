#!/usr/bin/env bash
set -eo pipefail

tmux-run 8<<EOF
php -S localhost:8011
IGN=index.html watch-any './template.sh'
EOF
