#!/usr/bin/env bash
set -eo pipefail

# tsv_to_html() {
#     awk 'BEGIN { print "<table border=1>" }
#         { print "<tr>"; for(i=1;i<=NF;i++) print "<td>" $i "</td>"; print "</tr>" }
#     END { print "</table>" }' FS='\t' "./biomarkers.tsv" >"./biomarkers.html"
# }

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
    grep -o '<INCLUDE [^ ]\+/>' "$1" | while read -r inc; do
        file=$(echo "$inc" | sed -E 's#<INCLUDE ([^ ]+)/>.*#\1#')
        # Escape sed special characters in inc for the search
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

printf "Templating %s...\n" "$(date +%T)"
tsv_to_html
template "./index.template.html"
./color-cells.py
autoformat_html "./index.html"
