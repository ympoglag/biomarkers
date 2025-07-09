#!/usr/bin/env python3
import os
import shutil

from bs4 import BeautifulSoup


def rewrite_html(html_path):
    with open(html_path, "r", encoding="utf-8") as file:
        soup = BeautifulSoup(file, "html5lib")

    for td in soup.find_all("td"):
        if (
            False
            or "(-)" in td.get_text()
            or "(+)" in td.get_text()
            or "(!)" in td.get_text()
            or False
        ):
            td["style"] = "background-color:#FFB3B3;"

    with open(html_path, "w", encoding="utf-8") as file:
        file.write(str(soup))


rewrite_html("./index.html")
