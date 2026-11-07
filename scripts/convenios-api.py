"""Lista de convenios de AvalPay Center llamando directo a su API (sin navegador).

La API (POST .../prd/serviciosconvenios) va cifrada con AES-128-CTR; la llave y el
formato salen del propio JS público del portal, que se descarga en cada corrida.

Uso: python convenios-api.py            # barre las categorías 1..60 y guarda convenios.json
     python convenios-api.py 19 25      # solo esas categorías
"""
import base64
import datetime
import hashlib
import json
import os
import re
import sys

import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

BASE = "https://www.avalpaycenter.com/mf-other-pages/"
URL = "https://z6vmsbfq9j.execute-api.us-east-1.amazonaws.com/prd/serviciosconvenios"


def load_key():
    # shortcut: el chunk "267" es el módulo WhatWantPay; si el portal lo renombra, ajustar aquí
    entry = requests.get(BASE + "remoteEntry.js", timeout=30).text
    chunk = re.search(r'\b267:"([0-9a-f]+)"', entry).group(1)
    js = requests.get(f"{BASE}267.{chunk}.js", timeout=60).text
    pem = re.search(r'P_search_privateKeyCryp="([^"]+)"', js).group(1)
    return hashlib.sha256(pem.encode()).digest()[:16]


KEY = load_key()


def ctr(data, iv, encrypt=False):
    c = Cipher(algorithms.AES(KEY), modes.CTR(iv))
    x = c.encryptor() if encrypt else c.decryptor()
    return x.update(data) + x.finalize()


def call(servicio, payload):
    iv = bytes(b % 10 for b in os.urandom(16))
    rq = base64.b64encode(ctr(json.dumps(payload, indent=2).encode(), iv, True)).decode()
    ids = base64.b64encode(",".join(str(b) for b in iv).encode()).decode()
    body = base64.b64encode(json.dumps({"id": ids, "rq": rq}).encode()).decode()
    sv = base64.b64encode(ctr(servicio.encode(), iv, True)).decode()
    r = requests.post(URL, data=body, headers={"servicio": sv, "Content-Type": "application/json"}, timeout=30)
    r.raise_for_status()
    jwt = ctr(base64.b64decode(r.text), iv).decode()
    seg = jwt.split(".")[1]
    seg += "=" * (-len(seg) % 4)
    return json.loads(json.loads(base64.urlsafe_b64decode(seg))["sub"])["result"]


def payload(page, size, cat, text=""):
    n = datetime.datetime.now()
    return {
        "resultsSize": size, "currentPage": page, "searchText": text, "idCategoria": str(cat),
        "department": None, "requestID": str(int(n.timestamp() * 1000)),
        "requestDate": n.strftime("%Y-%m-%dT%H:%M:%S"), "requestSender": "Convenios",
        "requestPage": "¿Que puedo pagar?", "requestOriginPortal": "AVAL",
        "requestUser": "", "ipAddress": "", "bankInfo": {},
    }


def convenios(cat):
    r = call("searchagreement", payload(1, 1, cat))
    total = r.get("totalResults", 0)
    if not total:
        return []
    r = call("searchagreement", payload(1, total, cat))
    return r["agreementResult"]["singleAgreement"]


if __name__ == "__main__":
    cats = sys.argv[1:] or range(1, 61)
    out = {}
    for c in cats:
        items = convenios(c)
        if items:
            out[str(c)] = items
            print(f"categoría {c}: {len(items)} convenios")
    with open("convenios.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("total:", sum(len(v) for v in out.values()), "-> convenios.json")
