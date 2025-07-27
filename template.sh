#!/usr/bin/env bash
set -eo pipefail

script_dir="$( dirname "$(realpath "$0")" )" 

tsv_to_html() {
    awk 'BEGIN { print "<table border=1>" }
        NR==1 {
            print "<tr>"
            for(i=1; i<=NF; i++) print "<th>" $i "</th>"
            print "</tr>"
            next
        }
        {
            print "<tr>"
            for(i=1; i<=NF; i++) print "<td>" $i "</td>"
            print "</tr>"
        }
    END { print "</table>" }' FS='\t' "./biomarkers.tsv" >"./biomarkers.html"
}

template() {
    cp "$1" "index.html"
    # Match both <template-include src="..." /> and <template-include src="..."></template-include>
    grep -o '<template-include src="[^"]\+"\s*/>\|<template-include src="[^"]\+"></template-include>' "$1" | while read -r inc; do
        # Extract filename from src="..."
        file=$(echo "$inc" | sed -E 's#<template-include src="([^"]+)".*#\1#')

        # Escape for sed pattern
        pat=$(printf '%s\n' "$inc" | sed 's/[][\.*^$/]/\\&/g')
        sed -i "/$pat/{
            r $file
            d
        }" "index.html"
    done
}

autoformat_html() {
    tmpfile=$(mktemp)
    cleanup_tmpfile() {
        rm -f "$tmpfile"
    }
    trap 'cleanup_tmpfile' EXIT INT

    args=(
        --custom-tags yes
        --indent yes
        --wrap-attributes 1
        -w 140
        --quiet 1
        --tidy-mark 0
        --break-before-br
        --drop-empty-elements no
    )
    if tidy "${args[@]}" "$1" >"$tmpfile"; then
        mv "$tmpfile" "$1"
    else
        echo "tidy failed: $1"
        rm "$tmpfile"
        exit 1
    fi
}

convert_md_to_html() {
    [[ -e "${1}/index.md" ]] || { echo "Missing index.md" >&2; exit 1; }
    cp "${script_dir}/css-markdown.css" "${1}/markdown.css"
    convert-md-to-html "${1}/index.md"
    sed -i "s|CURRENT_DATE|$(date '+%Y.%m.%d %T %Z')|g" "${1}/index.html"
}

printf "Templating %s...\n" "$(date +%T)"
tsv_to_html
template "./index.template.html"
./color-cells.py
autoformat_html "./index.html"

convert_md_to_html "./medical-findings/"
convert_md_to_html "./trials/"
convert_md_to_html "./trials/schellong-test-analysis/"
