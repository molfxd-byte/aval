import io
import os
import sys
import json
import base64
import select
import socket
import threading
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


def _start_local_socks5_proxy(upstream_host, upstream_port, upstream_user, upstream_pass):
    """
    Levanta un servidor SOCKS5 local (sin auth) en 127.0.0.1 que redirige
    todo el tráfico al proxy SOCKS5 upstream (con user/pass). Es necesario
    porque Chromium no soporta autenticación directa en SOCKS5.

    Returns: (local_port: int, stop_event: threading.Event)
    Llama stop_event.set() para apagar el servidor.
    """

    def _upstream_connect(host, port, atyp):
        """Abre conexión al upstream SOCKS5 y hace el CONNECT al destino."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(20)
        sock.connect((upstream_host, int(upstream_port)))

        # Greeting: soportamos no-auth (0x00) y usuario/contraseña (0x02)
        sock.sendall(b"\x05\x02\x00\x02")
        resp = sock.recv(2)
        if len(resp) < 2:
            raise ConnectionError("Upstream SOCKS5 no respondió saludo")

        if resp[1] == 0x02:  # auth usuario/contraseña
            user_b = upstream_user.encode("utf-8")
            pass_b = upstream_pass.encode("utf-8")
            sock.sendall(bytes([0x01, len(user_b)]) + user_b + bytes([len(pass_b)]) + pass_b)
            ar = sock.recv(2)
            if len(ar) < 2 or ar[1] != 0x00:
                raise ConnectionError("Auth SOCKS5 upstream rechazada")
        elif resp[1] != 0x00:
            raise ConnectionError(f"Upstream rechazó métodos: {resp[1]:#x}")

        # CONNECT request
        host_b = host.encode("utf-8") if isinstance(host, str) else host
        if atyp == 0x01:    # IPv4
            import ipaddress
            req = b"\x05\x01\x00\x01" + socket.inet_aton(host)
        elif atyp == 0x04:  # IPv6
            import ipaddress
            req = b"\x05\x01\x00\x04" + ipaddress.IPv6Address(host).packed
        else:               # Dominio (default)
            req = b"\x05\x01\x00\x03" + bytes([len(host_b)]) + host_b
        req += port.to_bytes(2, "big")
        sock.sendall(req)

        # Leer respuesta
        hdr = sock.recv(4)
        if len(hdr) < 4 or hdr[1] != 0x00:
            code = hdr[1] if len(hdr) > 1 else "?"
            raise ConnectionError(f"CONNECT upstream falló, código {code}")
        # Consumir dirección de respuesta
        resp_atyp = hdr[3]
        if resp_atyp == 0x01:
            sock.recv(6)   # 4 IPv4 + 2 puerto
        elif resp_atyp == 0x04:
            sock.recv(18)  # 16 IPv6 + 2 puerto
        elif resp_atyp == 0x03:
            ln = sock.recv(1)[0]
            sock.recv(ln + 2)

        return sock

    def _handle_client(cli):
        up = None
        try:
            # Saludo del cliente
            hdr = cli.recv(2)
            if len(hdr) < 2 or hdr[0] != 0x05:
                return
            cli.recv(hdr[1])          # ignorar métodos ofrecidos
            cli.sendall(b"\x05\x00") # responder: sin auth

            # Petición
            req = cli.recv(4)
            if len(req) < 4:
                return
            cmd, atyp = req[1], req[3]

            if atyp == 0x01:
                host = socket.inet_ntoa(cli.recv(4))
            elif atyp == 0x03:
                length = cli.recv(1)[0]
                host = cli.recv(length).decode("utf-8")
            elif atyp == 0x04:
                import ipaddress
                host = str(ipaddress.IPv6Address(cli.recv(16)))
            else:
                return

            port = int.from_bytes(cli.recv(2), "big")

            if cmd != 0x01:  # solo CONNECT
                cli.sendall(b"\x05\x07\x00\x01\x00\x00\x00\x00\x00\x00")
                return

            up = _upstream_connect(host, port, atyp)
            cli.sendall(b"\x05\x00\x00\x01\x00\x00\x00\x00\x00\x00")  # éxito

            # Reenvío bidireccional
            cli.setblocking(False)
            up.setblocking(False)
            pair = [cli, up]
            while True:
                r, _, ex = select.select(pair, [], pair, 60)
                if ex or not r:
                    break
                for s in r:
                    other = up if s is cli else cli
                    try:
                        data = s.recv(32768)
                        if not data:
                            return
                        other.sendall(data)
                    except BlockingIOError:
                        pass
        except Exception:
            pass
        finally:
            for s in (cli, up):
                if s:
                    try:
                        s.close()
                    except Exception:
                        pass

    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", 0))
    local_port = srv.getsockname()[1]
    srv.listen(32)
    srv.settimeout(1.0)

    stop_event = threading.Event()

    def _loop():
        while not stop_event.is_set():
            try:
                cli, _ = srv.accept()
                threading.Thread(target=_handle_client, args=(cli,), daemon=True).start()
            except socket.timeout:
                continue
            except Exception:
                break
        srv.close()

    threading.Thread(target=_loop, daemon=True).start()
    return local_port, stop_event


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
    import time
    import random
    import string
    headless_mode = os.environ.get("HEADLESS", "true").lower() not in ("false", "0", "no")

    # Configurar proxy desde variables de entorno
    proxy_host = os.environ.get("PROXY_HOST", "").strip()
    proxy_port = os.environ.get("PROXY_PORT", "").strip()
    proxy_socks_port = os.environ.get("PROXY_SOCKS_PORT", "").strip()
    proxy_user = os.environ.get("PROXY_USERNAME", "").strip()
    proxy_pass = os.environ.get("PROXY_PASSWORD", "").strip()

    proxy_config = None
    proxy_ip = None
    _socks5_stop = None  # stop_event del proxy local SOCKS5

    use_socks5 = bool(proxy_host and proxy_socks_port)
    has_proxy = proxy_host and (proxy_socks_port or proxy_port)

    if has_proxy:
        for intento in range(1, 4):
            # IPRoyal exige session ID estrictamente alfanumérico de 8 caracteres (sin guiones bajos)
            session_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
            base_pass = proxy_pass.split("_session-")[0] if "_session-" in proxy_pass else proxy_pass
            full_pass = f"{base_pass}_session-{session_id}_lifetime-10m" if base_pass else ""

            try:
                import requests as _req
                if use_socks5:
                    # SOCKS5h: el proxy resuelve el DNS (evita leaks y bloqueos)
                    socks_url = f"socks5h://{proxy_user}:{full_pass}@{proxy_host}:{proxy_socks_port}"
                    _proxies = {"http": socks_url, "https": socks_url}
                    proto_label = "SOCKS5"
                else:
                    http_url = f"http://{proxy_user}:{full_pass}@{proxy_host}:{proxy_port}"
                    _proxies = {"http": http_url, "https": http_url}
                    proto_label = "HTTP"

                r = _req.get(
                    "https://ipv4.icanhazip.com",
                    proxies=_proxies,
                    timeout=10,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                )
                if r.status_code == 200 and r.text.strip():
                    proxy_ip = r.text.strip()
                    _log(f"Proxy {proto_label} asignado exitosamente (intento {intento}, sesion {session_id}) → IP: {proxy_ip}")

                    if use_socks5:
                        local_port, _socks5_stop = _start_local_socks5_proxy(
                            upstream_host=proxy_host,
                            upstream_port=proxy_socks_port,
                            upstream_user=proxy_user,
                            upstream_pass=full_pass,
                        )
                        proxy_config = {"server": f"socks5://127.0.0.1:{local_port}"}
                        _log(f"Relay SOCKS5 local sin auth en puerto {local_port} → {proxy_host}:{proxy_socks_port}")
                    else:
                        proxy_config = {
                            "server": f"http://{proxy_host}:{proxy_port}",
                            "username": proxy_user,
                            "password": full_pass,
                        }
                    break
            except Exception as e:
                _log(f"Intento {intento}/3 con IP falló ({e}), rotando nodo...")
                if _socks5_stop:
                    _socks5_stop.set()
                    _socks5_stop = None
                time.sleep(1)

        if not proxy_config:
            _log("ADVERTENCIA: No se pudo obtener IP residencial estable tras 3 intentos. Conexión directa.")
    else:
        _log("Sin proxy configurado, conexión directa.")

    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    ]
    chosen_ua = random.choice(user_agents)
    viewports = [
        {"width": 1366, "height": 768},
        {"width": 1440, "height": 900},
        {"width": 1280, "height": 800},
    ]
    chosen_vp = random.choice(viewports)

    with sync_playwright() as p:
        launch_args = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--ignore-certificate-errors",
            "--disable-blink-features=AutomationControlled",
        ]
        browser = p.chromium.launch(
            headless=headless_mode,
            args=launch_args
        )
        context = browser.new_context(
            viewport=chosen_vp,
            proxy=proxy_config,
            ignore_https_errors=True,
            user_agent=chosen_ua,
            locale="es-CO",
            timezone_id="America/Bogota",
        )
        page = context.new_page()

        # Huella limpia de navegador residencial en Colombia
        page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
            Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es-419', 'es', 'en-US'] });
        """)

        captured_pse_url = []
        captured_kushki_url = []

        def _on_request(req):
            if "kushkipagos.com" in req.url and "token=" in req.url:
                if req.url not in captured_kushki_url:
                    captured_kushki_url.append(req.url)
                    _log(f"URL Kushki Token interceptada en red: {req.url}")
            if "registro.pse.com.co" in req.url or "pse.com.co" in req.url:
                if req.url not in captured_pse_url:
                    captured_pse_url.append(req.url)
                    _log(f"URL PSE interceptada en red: {req.url}")

        page.on("request", _on_request)

        try:
            target_url = data.get("url") or os.environ.get("PAYMENT_AUTOMATION_URL", "").strip()
            if not target_url:
                raise ValueError("No se configuró la URL de pago (PAYMENT_AUTOMATION_URL no encontrada en entorno ni en los datos de entrada).")

            _log(f"Navegando a: {target_url}")
            for intento_nav in range(1, 4):
                try:
                    page.goto(
                        target_url,
                        wait_until="domcontentloaded",
                        timeout=30000
                    )
                    break
                except Exception as e_nav:
                    if "ERR_TUNNEL_CONNECTION_FAILED" in str(e_nav) and intento_nav < 3:
                        _log(f"Túnel intermitente en intento {intento_nav}, reintentando carga en 2s...")
                        time.sleep(2)
                    else:
                        raise e_nav

            page.wait_for_timeout(random.randint(600, 1100))

            # Monto con escritura natural
            monto = _input(page, "text")
            monto.wait_for(state="visible", timeout=20000)
            monto.click()
            page.wait_for_timeout(random.randint(150, 300))
            monto.fill("")
            monto.press_sequentially(str(data["monto"]).strip(), delay=random.randint(35, 75))
            page.wait_for_timeout(random.randint(350, 650))

            # Banco
            banco = _select(
                page,
                "Elige tu banco",
                data["banco"]
            )
            page.wait_for_timeout(random.randint(350, 650))

            # Tipo de documento
            tipo = _select(
                page,
                "Elige tipo de documento",
                data["tipo"]
            )
            page.wait_for_timeout(random.randint(350, 650))

            # Documento con escritura natural
            doc_limpio = data["doc"].strip()[:10]
            doc = _input(page, "document")
            doc.click()
            page.wait_for_timeout(random.randint(150, 300))
            doc.fill("")
            doc.press_sequentially(doc_limpio, delay=random.randint(40, 80))
            page.wait_for_timeout(random.randint(450, 800))

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
            try:
                page.wait_for_function(
                    """() => [...document.querySelectorAll('button')]
                        .some(b =>
                            b.innerText.trim() === 'Transferir' &&
                            !b.disabled &&
                            b.getClientRects().length > 0
                        )""",
                    timeout=8000
                )
            except Exception:
                # Comprobar causas comunes de deshabilitación (por ejemplo monto mínimo)
                try:
                    num_monto = int(str(data["monto"]).replace(".", "").replace(",", "").strip())
                    if num_monto < 10000:
                        raise Exception(f"El monto ingresado (${num_monto:,}) es inferior al mínimo permitido por la pasarela ($10.000).")
                except ValueError:
                    pass
                raise Exception("El botón Transferir no se habilitó en la pasarela. Verifique que el monto sea mínimo de $10.000.")

            habilitado = boton.is_enabled()
            _log(f"Transferir habilitado: {habilitado}")

            if not habilitado:
                raise Exception(
                    "El botón Transferir continúa deshabilitado."
                )

            # Guardar URL inicial
            url_inicial = page.url

            # Movimiento natural de mouse sobre el botón Transferir antes de hacer clic
            try:
                box = boton.bounding_box()
                if box:
                    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
                    page.wait_for_timeout(random.randint(250, 450))
            except Exception:
                pass

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
            png = None
            try:
                png = pagina_final.screenshot(full_page=True)
            except Exception:
                pass
            url_destino = pagina_final.url
            if (not url_destino or url_destino == url_inicial or "linkdepagospse.rappipay.co" in url_destino) and captured_pse_url:
                url_destino = captured_pse_url[0]
                _log(f"Usando URL PSE interceptada en tráfico de red: {url_destino}")

            # Revisar si la pasarela rechazó el link o la transacción
            texto_pantalla = ""
            try:
                texto_pantalla = pagina_final.locator("body").inner_text()
            except Exception:
                pass

            if "Link de pago PSE rechazado" in texto_pantalla or "no podemos continuar con la transacción" in texto_pantalla:
                _log("La pasarela RappiPay mostró: 'Link de pago PSE rechazado'. Este link específico está inhabilitado/quemado por la pasarela.")
                raise Exception("El link de pago PSE fue rechazado por RappiPay ('Link de pago PSE rechazado'). Debe generarse un nuevo link.")

            _log(f"URL capturada para el frontend: {url_destino}")
            if not url_destino or url_destino == url_inicial or "linkdepagospse.rappipay.co" in url_destino:
                raise Exception(f"No se generó redirección bancaria tras el envío; URL destino inválida: {url_destino}")
            kushki_url = captured_kushki_url[0] if captured_kushki_url else (url_destino if "kushkipagos.com" in url_destino else None)
            return habilitado, png, url_destino, proxy_ip, kushki_url

        finally:
            browser.close()
    # Apagar el relay SOCKS5 local si se levantó
    if _socks5_stop:
        _socks5_stop.set()


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

        enabled, png, redirect_url, proxy_ip, kushki_url = fill(data)

        # UNICO output en stdout es el marcador y el JSON para no mezclar con prints de depuración
        result = {
            "enabled": enabled,
            "png": base64.b64encode(png).decode() if png else None,
            "redirect_url": redirect_url,
            "kushki_url": kushki_url,
            "proxy_ip": proxy_ip,
        }
        print("---JSON_START---")
        print(json.dumps(result))
        print("---JSON_END---")
        sys.stdout.flush()

    except Exception as e:
        _log(f"Error: {e}")
        sys.exit(1)