#!/usr/bin/env python3
import os
import shutil

from bs4 import BeautifulSoup

background_color_done = "#DDD"
background_color_none = "#F2F2F2"

def rewrite_html(html_path):
    with open(html_path, "r", encoding="utf-8") as file:
        soup = BeautifulSoup(file, "html5lib")

    def color_cells_below_last_content(table):
        rows = table.find_all("tr")
        # Only consider rows that actually have <td> cells
        data_rows = [row for row in rows if row.find_all("td")]
        if not data_rows:
            return
        num_cols = max(len(row.find_all("td")) for row in data_rows)
        for col_idx in range(num_cols):
            last_content_row_idx = -1
            # Find last cell in this column with content
            for row_idx, row in enumerate(data_rows):
                cells = row.find_all("td")
                if col_idx < len(cells):
                    text = cells[col_idx].get_text(strip=True)
                    if text != "":
                        last_content_row_idx = row_idx
            # Color all cells below that cell with background_color_done
            for row_idx in range(last_content_row_idx + 1, len(data_rows)):
                cells = data_rows[row_idx].find_all("td")
                if col_idx < len(cells):
                    cell = cells[col_idx]
                    existing_style = cell.get("style", "")
                    done_style = f"background-color:{background_color_done};"
                    cell["style"] = existing_style + done_style

    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if not cells:
                continue  # skip header/empty rows
            found = False
            for cell in cells:
                text = cell.get_text()
                if "(-)" in text or "(+)" in text or "(!)" in text:
                    cell["style"] = "background-color:#FFB3B3;"
                    found = True
                elif "(?)" in text:
                    cell["style"] = "background-color:#FFD9FF;"
                    found = True
                elif text.strip() == "":  # Color empty cells
                    cell["style"] = f"background-color:{background_color_none};"
            if found:
                cells[0]["style"] = "background-color:#FFE6E6;"  # Highlight first column

        # After doing your previous coloring, now color the cells below the last content in each column
        color_cells_below_last_content(table)

    with open(html_path, "w", encoding="utf-8") as file:
        file.write(str(soup))


rewrite_html("./index.html")

