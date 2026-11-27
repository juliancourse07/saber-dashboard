"""Enlaza el logo desde el sitio institucional, sin recrearlo ni modificarlo."""
import json
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

HOME = "https://itp.edu.co/ITP2022/"


def institutional(url):
    host = urlparse(url).hostname or ""
    return url.startswith("https://") and (host == "itp.edu.co" or host.endswith(".itp.edu.co"))


def logo():
    page = requests.get(HOME, timeout=25)
    page.raise_for_status()
    soup = BeautifulSoup(page.content, "html.parser")
    images = soup.select('img.custom-logo, .site-logo img, .logo img, header img, img')
    for img in images:
        src = urljoin(HOME, img.get("data-src") or img.get("src") or "")
        clue = (src + " " + str(img.get("alt", ""))).lower()
        branded = "logo" in clue and ("uniputumayo" in clue or "instituci" in clue or "itp" in src.split("/")[-1].lower())
        if institutional(src) and ("custom-logo" in img.get("class", []) or branded):
            return src
    icon = soup.select_one('link[rel~="icon"][href]')
    if icon and institutional(url := urljoin(HOME, icon["href"])):
        return url
    raise ValueError("No se encontró el distintivo institucional en la página oficial")


if __name__ == "__main__":
    try:
        src = logo()
    except (requests.RequestException, ValueError) as error:
        print(f"::warning::Identidad institucional no disponible: {error}")
        src = None
    (Path(sys.argv[1]) / "brand.json").write_text(json.dumps({"url": src}))
