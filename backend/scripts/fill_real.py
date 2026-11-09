import io
import os
import sys
import json
import base64
import unicodedata
from pathlib import Path
from playwright.sync_api import sync_playwright

# Configurar stdin, stdout y stderr con UTF-8
if sys.platform == "win32":
    sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


def _log(msg):
    sys.stderr.write(f"{msg}\n")
    sys.stderr.flush()


def _vis(loc):
    return loc.locator("visible=true").first


def _input(page, kind):
    return _vis(page.locator(f"input[type='{kind}']"))


def _norm(s):
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if not unicodedata.combining(c)
    ).casefold().strip()


def _select(page, label, option):
    box = _vis(
        page.locator(".MuiFormControl-root").filter(has_text=label)
    )

    combo = box.get_by_role("combobox")
    combo.click()
    page.wait_for_timeout(300)

    # Esperar a que las opciones estén visibles en el DOM
    page.locator("[role='option']").first.wait_for(state="visible", timeout=10000)
    opciones = page.get_by_role("option").all()
    n_option = _norm(option)

    # 1. Coincidencia exacta normalizada
    for o in opciones:
        if _norm(o.inner_text()) == n_option:
            o.click()
            page.wait_for_timeout(200)
            return combo

    # 2. Coincidencia parcial (por ejemplo 'ciudadania' sin tilde con 'ciudadania')
    for o in opciones:
        t = _norm(o.inner_text())
        if n_option in t or t in n_option:
            o.click()
            page.wait_for_timeout(200)
            return combo

    disponibles = [o.inner_text().strip() for o in opciones]
    raise ValueError(
        f"No existe la opción '{option}' en '{label}'. Disponibles: {disponibles}"
    )


def _boton_transferir(page):
    botones = page.get_by_role(
        "button",
        name="Transferir",
        exact=True
    ).all()

    for boton in botones:
        if boton.is_visible():
            return boton

    alternativo = page.locator(
        "button.e1tee1v22:visible, button.e1tee1v24:visible"
    ).first

    if alternativo.count() and alternativo.is_visible():
        return alternativo

    raise Exception(
        "No se encontró el botón Transferir visible."
    )


def _detectar_redireccion(page, browser_context, url_inicial):
    pagina_nueva = None

    try:
        # Esperar un cambio de URL en la pestaña actual
        page.wait_for_function(
            "url => window.location.href !== url",
            arg=url_inicial,
            timeout=15000
        )
        _log("Redirección detectada en la misma pestaña.")

    except Exception:
        # Comprobar si se abrió una pestaña nueva
        paginas = [
            p for p in browser_context.pages
            if p != page
        ]

        if paginas:
            pagina_nueva = paginas[-1]
            _log("Se detectó una nueva pestaña.")
        else:
            _log("No se detectó ninguna redirección.")
            return page

    # Seleccionar la página de destino
    destino = pagina_nueva if pagina_nueva else page

    # Esperar a que cargue
    try:
        destino.wait_for_load_state(
            "domcontentloaded",
            timeout=15000
        )
    except Exception:
        _log("La página continúa cargando.")

    _log(f"URL de destino: {destino.url}")
    return destino


def fill(data):
    headless_mode = os.environ.get("HEADLESS", "true").lower() not in ("false", "0", "no")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless_mode,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        context = browser.new_context(
            viewport={"width": 1100, "height": 1000}
        )
        page = context.new_page()

        try:
            target_url = data.get("url") or os.environ.get("PAYMENT_AUTOMATION_URL", "").strip()
            if not target_url:
                raise ValueError("No se configuró la URL de pago (PAYMENT_AUTOMATION_URL no encontrada en entorno ni en los datos de entrada).")

            _log(f"Navegando a: {target_url}")
            page.goto(
                target_url,
                wait_until="networkidle",
                timeout=45000
            )

            # Monto
            monto = _input(page, "text")
            monto.wait_for(state="visible", timeout=20000)
            monto.fill(data["monto"])

            # Banco
            banco = _select(
                page,
                "Elige tu banco",
                data["banco"]
            )

            # Tipo de documento
            tipo = _select(
                page,
                "Elige tipo de documento",
                data["tipo"]
            )

            # Documento
            doc_limpio = data["doc"].strip()[:10]
            doc = _input(page, "document")
            doc.fill(doc_limpio)
            page.wait_for_timeout(300)

            # Validación de los campos
            banco_text = _norm(banco.inner_text())
            banco_expected = _norm(data["banco"])
            tipo_text = _norm(tipo.inner_text())
            tipo_expected = _norm(data["tipo"])
            doc_val = doc.input_value().strip()
            monto_val = (
                monto.input_value()
                .replace(".", "")
                .replace(",", "")
                .replace("$", "")
                .replace(" ", "")
            )

            banco_ok = (banco_text == banco_expected) or (banco_expected in banco_text) or (banco_text in banco_expected)
            tipo_ok = (tipo_text == tipo_expected) or (tipo_expected in tipo_text) or (tipo_text in tipo_expected)
            doc_ok = (doc_val == doc_limpio) or (doc_val in doc_limpio) or (doc_limpio in doc_val)
            monto_ok = (data["monto"] in monto_val) or (monto_val in data["monto"])

            _log(f"Valores ingresados -> Banco: '{banco.inner_text()}' (ok: {banco_ok}), Tipo: '{tipo.inner_text()}' (ok: {tipo_ok}), Doc: '{doc_val}' (ok: {doc_ok}), Monto: '{monto.input_value()}' (ok: {monto_ok})")

            if not (banco_ok and tipo_ok and doc_ok and monto_ok):
                fallos = []
                if not banco_ok:
                    fallos.append(f"banco (esperado '{data['banco']}', actual '{banco.inner_text()}')")
                if not tipo_ok:
                    fallos.append(f"tipo (esperado '{data['tipo']}', actual '{tipo.inner_text()}')")
                if not doc_ok:
                    fallos.append(f"doc (esperado '{doc_limpio}', actual '{doc_val}')")
                if not monto_ok:
                    fallos.append(f"monto (esperado '{data['monto']}', actual '{monto.input_value()}')")
                raise Exception(f"La validación de los campos no fue correcta en: {', '.join(fallos)}")

            # Aviso de privacidad
            _vis(
                page.locator("input[type='checkbox']")
            ).check()

            page.wait_for_timeout(800)

            # Buscar botón
            boton = _boton_transferir(page)

            # Esperar habilitación
            page.wait_for_function(
                """() => [...document.querySelectorAll('button')]
                    .some(b =>
                        b.innerText.trim() === 'Transferir' &&
                        !b.disabled &&
                        b.getClientRects().length > 0
                    )""",
                timeout=20000
            )

            habilitado = boton.is_enabled()
            _log(f"Transferir habilitado: {habilitado}")

            if not habilitado:
                raise Exception(
                    "El botón Transferir continúa deshabilitado."
                )

            # Guardar URL inicial
            url_inicial = page.url

            # Hacer clic
            boton.click()
            _log("Se hizo clic en Transferir.")

            # Detectar redirección
            pagina_final = _detectar_redireccion(
                page,
                context,
                url_inicial
            )

            # Captura de la página final
            png = pagina_final.screenshot(full_page=True)
            url_destino = pagina_final.url

            _log(f"URL capturada para el frontend: {url_destino}")
            if not url_destino or url_destino == url_inicial or "linkdepagospse.rappipay.co" in url_destino:
                raise Exception(f"No se generó redirección bancaria tras el envío; URL destino inválida: {url_destino}")
            return habilitado, png, url_destino

        finally:
            browser.close()


if __name__ == "__main__":
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            data = {
                "monto": "10000",
                "banco": "NEQUI",
                "tipo": "Cédula de ciudadania",
                "doc": "1234567890",
            }
        else:
            data = json.loads(raw_input)

        enabled, png, redirect_url = fill(data)

        # UNICO output en stdout es el marcador y el JSON para no mezclar con prints de depuración
        result = {
            "enabled": enabled,
            "png": base64.b64encode(png).decode() if png else None,
            "redirect_url": redirect_url
        }
        print("---JSON_START---")
        print(json.dumps(result))
        print("---JSON_END---")
        sys.stdout.flush()

    except Exception as e:
        _log(f"Error: {e}")
        sys.exit(1)