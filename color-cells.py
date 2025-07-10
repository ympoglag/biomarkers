#!/usr/bin/env python3
import os
import shutil

from bs4 import BeautifulSoup

background_color_done = "#DDD"
background_color_none = "#F2F2F2"
background_color_none_event = "#A6A6A6"

def rewrite_html(html_path):
    with open(html_path, "r", encoding="utf-8") as file:
        soup = BeautifulSoup(file, "html5lib")

    def get_event_columns(table):
        # Find the row where the first column is "Meta:Event"
        event_row = None
        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if cells and cells[0].get_text(strip=True) == "Meta:Event":
                event_row = cells
                break
        if not event_row:
            return set()
        # Mark columns with non-empty value in this row as event columns (excluding the first column)
        event_columns = set()
        for i, cell in enumerate(event_row[1:], 1):
            if cell.get_text(strip=True) != "":
                event_columns.add(i)
        return event_columns

    def color_cells_below_last_content(table):
        rows = table.find_all("tr")
        data_rows = [row for row in rows if row.find_all("td")]
        if not data_rows:
            return
        num_cols = max(len(row.find_all("td")) for row in data_rows)
        for col_idx in range(num_cols):
            last_content_row_idx = -1
            for row_idx, row in enumerate(data_rows):
                cells = row.find_all("td")
                if col_idx < len(cells):
                    text = cells[col_idx].get_text(strip=True)
                    if text != "":
                        last_content_row_idx = row_idx
            for row_idx in range(last_content_row_idx + 1, len(data_rows)):
                cells = data_rows[row_idx].find_all("td")
                if col_idx < len(cells):
                    cell = cells[col_idx]
                    existing_style = cell.get("style", "")
                    done_style = f"background-color:{background_color_done};"
                    cell["style"] = existing_style + done_style

    for table in soup.find_all("table"):
        event_columns = get_event_columns(table)
        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if not cells:
                continue  # skip header/empty rows
            found = False
            for idx, cell in enumerate(cells):
                text = cell.get_text()
                if "(-)" in text or "(+)" in text or "(!)" in text:
                    cell["style"] = "background-color:#FFB3B3;"
                    found = True
                elif "(?)" in text:
                    cell["style"] = "background-color:#FFD9FF;"
                    found = True
                elif text.strip() == "":
                    # Empty cell, use special color if column is an event column
                    if idx in event_columns:
                        cell["style"] = f"background-color:{background_color_none_event};"
                    else:
                        cell["style"] = f"background-color:{background_color_none};"
            if found:
                cells[0]["style"] = "background-color:#FFE6E6;"

        color_cells_below_last_content(table)

    with open(html_path, "w", encoding="utf-8") as file:
        file.write(str(soup))

rewrite_html("./index.html")

