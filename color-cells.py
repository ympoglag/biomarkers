#!/usr/bin/env python3
import os
import shutil

from bs4 import BeautifulSoup


def rewrite_html(html_path):
    with open(html_path, "r", encoding="utf-8") as file:
        soup = BeautifulSoup(file, "html5lib")

    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if not cells:
                continue  # skip header/empty rows
            # Track if any cell matches
            found = False
            for cell in cells:
                text = cell.get_text()
                if "(-)" in text or "(+)" in text or "(!)" in text:
                    cell["style"] = (
                        "background-color:#FFB3B3;"  # Highlight matching cell
                    )
                    found = True
            if found:
                cells[0][
                    "style"
                ] = "background-color:#FFE6E6;"  # Highlight first column

    with open(html_path, "w", encoding="utf-8") as file:
        file.write(str(soup))


rewrite_html("./index.html")
