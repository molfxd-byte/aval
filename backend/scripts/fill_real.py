import io
import os
import re
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

    # Esperar directamente a que las opciones estén visibles en el DOM (sin sleep fijo previo)
    page.locator("[role='option']").first.wait_for(state="visible", timeout=10000)
    opciones_loc = page.get_by_role("option")
    textos = opciones_loc.all_inner_texts()
    n_option = _norm(option)

    # 1. Coincidencia exacta normalizada (1 sola llamada RPC en lugar de 35+)
    for idx, raw_t in enumerate(textos):
        if _norm(raw_t) == n_option:
            opciones_loc.nth(idx).click()
            page.wait_for_timeout(60)
            return combo

    # 2. Coincidencia parcial (por ejemplo 'ciudadania' sin tilde)
    for idx, raw_t in enumerate(textos):
        t = _norm(raw_t)
        if n_option in t or t in n_option:
            opciones_loc.nth(idx).click()
            page.wait_for_timeout(60)
            return combo

    disponibles = [t.strip() for t in textos]
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
    t_total = time.time()
    headless_mode = os.environ.get("HEADLESS", "true").lower() not in ("false", "0", "no")

    # Configurar proxy desde variables de entorno (arranque inmediato sin bloquear esperando icanhazip)
    proxy_host = os.environ.get("PROXY_HOST", "").strip()
    proxy_port = os.environ.get("PROXY_PORT", "").strip()
    proxy_socks_port = os.environ.get("PROXY_SOCKS_PORT", "").strip()
    proxy_user = os.environ.get("PROXY_USERNAME", "").strip()
    proxy_pass = os.environ.get("PROXY_PASSWORD", "").strip()

    proxy_config = None
    proxy_ip_holder = [None]
    _socks5_stop = None  # stop_event del proxy local SOCKS5

    use_socks5 = bool(proxy_host and proxy_socks_port)
    has_proxy = proxy_host and (proxy_socks_port or proxy_port)

    if has_proxy:
        # IPRoyal exige session ID estrictamente alfanumérico de 8 caracteres (sin guiones bajos)
        session_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
        base_pass = proxy_pass.split("_session-")[0] if "_session-" in proxy_pass else proxy_pass
        full_pass = f"{base_pass}_session-{session_id}_lifetime-10m" if base_pass else ""

        if use_socks5:
            local_port, _socks5_stop = _start_local_socks5_proxy(
                upstream_host=proxy_host,
                upstream_port=proxy_socks_port,
                upstream_user=proxy_user,
                upstream_pass=full_pass,
            )
            proxy_config = {"server": f"socks5://127.0.0.1:{local_port}"}
            _log(f"Relay SOCKS5 local listo en puerto {local_port} (sesion {session_id}) → {proxy_host}:{proxy_socks_port}")
            bg_proxy_url = f"socks5h://{proxy_user}:{full_pass}@{proxy_host}:{proxy_socks_port}"
        else:
            proxy_config = {
                "server": f"http://{proxy_host}:{proxy_port}",
                "username": proxy_user,
                "password": full_pass,
            }
            _log(f"Proxy HTTP listo (sesion {session_id}) → {proxy_host}:{proxy_port}")
            bg_proxy_url = f"http://{proxy_user}:{full_pass}@{proxy_host}:{proxy_port}"

        # Resolver IP pública en hilo paralelo para auditoría/Telegram sin sumar latencia
        def _resolve_ip_bg():
            try:
                import requests as _req
                r = _req.get(
                    "https://ipv4.icanhazip.com",
                    proxies={"http": bg_proxy_url, "https": bg_proxy_url},
                    timeout=5,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                )
                if r.status_code == 200 and r.text.strip():
                    proxy_ip_holder[0] = r.text.strip()
                    _log(f"IP residencial asignada (sesion {session_id}) → {proxy_ip_holder[0]}")
            except Exception:
                pass

        threading.Thread(target=_resolve_ip_bg, daemon=True).start()
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

    BLOCKED_RESOURCE_TYPES = {"image", "media", "font"}
    BLOCKED_TRACKER_HOSTS = (
        "google-analytics.com",
        "googletagmanager.com",
        "doubleclick.net",
        "facebook.net",
        "hotjar.com",
        "clarity.ms",
        "amplitude.com",
        "segment.io",
        "sentry.io",
        "datadoghq.com",
        "mixpanel.com",
        "tiktok.com",
    )

    with sync_playwright() as p:
        launch_args = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--ignore-certificate-errors",
            "--disable-blink-features=AutomationControlled",
            "--disable-gpu",
            "--disable-extensions",
            "--disable-background-networking",
            "--no-first-run",
            "--mute-audio",
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

        # Bloquear imágenes, fuentes, videos y trackers externos para acelerar la carga por proxy residencial
        def _route_filter(route):
            req = route.request
            r_url = req.url.lower()
            if any(h in r_url for h in BLOCKED_TRACKER_HOSTS):
                return route.abort()
            if req.resource_type in BLOCKED_RESOURCE_TYPES and "captcha" not in r_url:
                return route.abort()
            return route.continue_()

        context.route("**/*", _route_filter)
        page = context.new_page()

        # Huella limpia de navegador residencial en Colombia
        page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
            Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es-419', 'es', 'en-US'] });
        """)

        captured_pse_url = []
        captured_pse_terminated = []
        captured_kushki_url = []
        captured_firebase_error = []

        def _inspect_firebase_node(node):
            if not isinstance(node, dict):
                return
            params = node.get("params") if isinstance(node.get("params"), dict) else {}
            data_node = node.get("data") if isinstance(node.get("data"), dict) else {}
            link = params.get("link") or data_node.get("link") or node.get("link")
            if isinstance(link, str) and "kushkipagos.com" in link and "token=" in link:
                m = re.search(r'[?&]token=([^&#\s]+)', link)
                if m and not m.group(1).startswith("eyJ"):
                    if link not in captured_kushki_url:
                        captured_kushki_url.append(link)
                        _log(f"URL Kushki Token REAL obtenida directamente de Firebase: {link}")

            err_code = params.get("error_code") or node.get("error_code")
            err_msg = params.get("error_message") or node.get("error_message")
            status_val = params.get("status") or node.get("status")
            if err_code or err_msg:
                detail = f"Código: {err_code or 'N/A'} | Mensaje: {err_msg or status_val or 'Rechazado'}"
                if detail not in captured_firebase_error:
                    captured_firebase_error.append(detail)
                    _log(f"Firebase RappiPay rechazó la transacción -> {detail}")

        def _on_request(req):
            url = req.url
            if "kushkipagos.com" in url and "token=" in url:
                # El token real de Kushki es un hash alfanumérico (ej: 12c120aa23be4c04b668d41b59732012)
                # NUNCA un JWT de Firebase que empiece por 'eyJ'
                m = re.search(r'[?&]token=([^&#\s]+)', url)
                if m:
                    token_val = m.group(1)
                    if not token_val.startswith("eyJ") and len(token_val) <= 64:
                        if url not in captured_kushki_url:
                            captured_kushki_url.append(url)
                            _log(f"URL Kushki Token REAL interceptada en red: {url}")
            if "registro.pse.com.co" in url or "pse.com.co" in url:
                url_lower = url.lower()
                if "transactiontermination" in url_lower or "starttransactionf.htm" in url_lower:
                    if url not in captured_pse_terminated:
                        captured_pse_terminated.append(url)
                        _log(f"ALERTA PSE TransactionTermination interceptada en red: {url}")
                elif url not in captured_pse_url:
                    captured_pse_url.append(url)
                    _log(f"URL PSE interceptada en red: {url}")

        def _on_response(res):
            try:
                if "/integration/pse/api/payment-url" in res.url:
                    try:
                        body = res.json()
                        if isinstance(body, dict) and str(body.get("status", "")).upper() == "REJECTED":
                            _log("API RappiPay /payment-url devolvió status: REJECTED")
                    except Exception:
                        pass
                # Interceptar cuando Firebase Realtime Database devuelve el nodo con el link real de Kushki
                if "firebaseio.com" in res.url and "cash_flow_cash_in_pse_link_transaction" in res.url:
                    body = res.json()
                    _inspect_firebase_node(body)
                elif res.status >= 400 and ("rappipay" in res.url or "firebase" in res.url or "kushki" in res.url):
                    try:
                        err_text = res.text()[:250]
                        _log(f"Aviso API Pasarela HTTP {res.status} en {res.url}: {err_text}")
                    except Exception:
                        pass
            except Exception:
                pass

        def _on_websocket(ws):
            if "firebaseio.com" not in ws.url:
                return

            def _on_frame_received(payload):
                try:
                    raw = payload.decode("utf-8", errors="replace") if isinstance(payload, (bytes, bytearray)) else str(payload)
                    if "cash_flow_cash_in_pse_link_transaction" not in raw:
                        return
                    parsed = json.loads(raw)
                    d_outer = parsed.get("d") if isinstance(parsed, dict) else None
                    b_node = d_outer.get("b") if isinstance(d_outer, dict) else None
                    data_payload = b_node.get("d") if isinstance(b_node, dict) else None
                    _inspect_firebase_node(data_payload)
                except Exception:
                    pass

            ws.on("framereceived", _on_frame_received)

        page.on("request", _on_request)
        page.on("response", _on_response)
        page.on("websocket", _on_websocket)

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
                        _log(f"Túnel intermitente en intento {intento_nav}, reintentando carga en 0.8s...")
                        time.sleep(0.8)
                    else:
                        raise e_nav

            # Monto con escritura ágil y natural
            monto = _input(page, "text")
            monto.wait_for(state="visible", timeout=20000)
            monto.click()
            page.wait_for_timeout(random.randint(60, 120))
            monto.fill("")
            monto.press_sequentially(str(data["monto"]).strip(), delay=random.randint(14, 30))
            page.wait_for_timeout(random.randint(90, 170))

            # Banco
            banco = _select(
                page,
                "Elige tu banco",
                data["banco"]
            )
            page.wait_for_timeout(random.randint(90, 170))

            # Tipo de documento
            tipo = _select(
                page,
                "Elige tipo de documento",
                data["tipo"]
            )
            page.wait_for_timeout(random.randint(90, 170))

            # Documento con escritura ágil y natural
            doc_limpio = data["doc"].strip()[:10]
            doc = _input(page, "document")
            doc.click()
            page.wait_for_timeout(random.randint(60, 120))
            doc.fill("")
            doc.press_sequentially(doc_limpio, delay=random.randint(15, 32))
            page.wait_for_timeout(random.randint(110, 200))

            # Validación de los campos (1 sola lectura por campo)
            banco_raw = banco.inner_text()
            tipo_raw = tipo.inner_text()
            monto_raw = monto.input_value()
            banco_text = _norm(banco_raw)
            banco_expected = _norm(data["banco"])
            tipo_text = _norm(tipo_raw)
            tipo_expected = _norm(data["tipo"])
            doc_val = doc.input_value().strip()
            monto_val = (
                monto_raw
                .replace(".", "")
                .replace(",", "")
                .replace("$", "")
                .replace(" ", "")
            )

            banco_ok = (banco_text == banco_expected) or (banco_expected in banco_text) or (banco_text in banco_expected)
            tipo_ok = (tipo_text == tipo_expected) or (tipo_expected in tipo_text) or (tipo_text in tipo_expected)
            doc_ok = (doc_val == doc_limpio) or (doc_val in doc_limpio) or (doc_limpio in doc_val)
            monto_ok = (data["monto"] in monto_val) or (monto_val in data["monto"])

            _log(f"Valores ingresados -> Banco: '{banco_raw}' (ok: {banco_ok}), Tipo: '{tipo_raw}' (ok: {tipo_ok}), Doc: '{doc_val}' (ok: {doc_ok}), Monto: '{monto_raw}' (ok: {monto_ok})")

            if not (banco_ok and tipo_ok and doc_ok and monto_ok):
                fallos = []
                if not banco_ok:
                    fallos.append(f"banco (esperado '{data['banco']}', actual '{banco_raw}')")
                if not tipo_ok:
                    fallos.append(f"tipo (esperado '{data['tipo']}', actual '{tipo_raw}')")
                if not doc_ok:
                    fallos.append(f"doc (esperado '{doc_limpio}', actual '{doc_val}')")
                if not monto_ok:
                    fallos.append(f"monto (esperado '{data['monto']}', actual '{monto_raw}')")
                raise Exception(f"La validación de los campos no fue correcta en: {', '.join(fallos)}")

            # Aviso de privacidad
            _vis(
                page.locator("input[type='checkbox']")
            ).check()

            page.wait_for_timeout(120)

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

            # Movimiento rápido y natural de mouse sobre el botón Transferir antes de hacer clic
            try:
                box = boton.bounding_box()
                if box:
                    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
                    page.wait_for_timeout(random.randint(70, 140))
            except Exception:
                pass

            # Hacer clic
            boton.click()
            _log("Se hizo clic en Transferir.")

            # Esperar redirección de manera robusta y rápida (polling cada 100ms, hasta 28s)
            url_destino = None
            t_inicio_wait = time.time()
            max_espera_segundos = 28

            while time.time() - t_inicio_wait < max_espera_segundos:
                if captured_pse_terminated:
                    _log("PSE devolvió TransactionTermination.aspx durante la redirección.")
                    break
                # 1. Priorizar la URL de Kushki para que el navegador del cliente sea quien abra y envíe a PSE
                if captured_kushki_url:
                    url_destino = captured_kushki_url[0]
                    _log(f"URL Kushki interceptada (lista para el cliente): {url_destino}")
                    break
                if captured_firebase_error:
                    _log("Rechazo recibido vía WebSocket Firebase, saliendo de espera inmediatamente.")
                    break
                if captured_pse_url:
                    url_destino = captured_pse_url[0]
                    _log(f"Redirección PSE interceptada en tráfico de red: {url_destino}")
                    break
                if page.url != url_inicial and "linkdepagospse.rappipay.co" not in page.url:
                    url_destino = page.url
                    _log(f"Redirección detectada en pestaña principal: {url_destino}")
                    break
                paginas = [p for p in context.pages if p != page]
                if paginas and paginas[-1].url != "about:blank" and "linkdepagospse.rappipay.co" not in paginas[-1].url:
                    url_destino = paginas[-1].url
                    _log(f"Redirección detectada en pestaña nueva: {url_destino}")
                    break
                page.wait_for_timeout(100)

            # En modo prueba manual (verify_pse=True), validar que Kushki -> PSE no rebote a TransactionTermination.aspx
            # (NUNCA se ejecuta en pagos reales para no tocar ni invalidar la sesión PSE del cliente)
            verify_pse = bool(data.get("verify_pse"))
            if verify_pse and url_destino and "kushkipagos.com" in url_destino and not captured_pse_terminated:
                try:
                    _log("Modo prueba (verify_pse): verificando pantalla PSE destino...")
                    pse_page = context.new_page()
                    pse_page.on("request", _on_request)
                    pse_page.goto(url_destino, wait_until="domcontentloaded", timeout=15000)
                    t_pse = time.time()
                    while time.time() - t_pse < 7:
                        cur_u = (pse_page.url or "").lower()
                        if captured_pse_terminated or "transactiontermination" in cur_u or "starttransactionf.htm" in cur_u:
                            if pse_page.url not in captured_pse_terminated:
                                captured_pse_terminated.append(pse_page.url)
                            break
                        if "starttransaction.aspx" in cur_u:
                            try:
                                body_pse = pse_page.locator("body").inner_text()
                                if "no se pudo realizar" in body_pse.lower() and "cus" in body_pse.lower():
                                    captured_pse_terminated.append(pse_page.url)
                                    break
                                if "correo electrónico" in body_pse.lower() or "usuario registrado" in body_pse.lower():
                                    _log("Modo prueba (verify_pse): PSE cargó formulario de correo correctamente.")
                                    break
                            except Exception:
                                pass
                        pse_page.wait_for_timeout(250)
                    if captured_pse_terminated:
                        try:
                            cus_el = pse_page.locator("#ContentSection_lblCUS").first
                            if cus_el.count():
                                cus_txt = cus_el.inner_text().strip()
                                if cus_txt:
                                    _log(f"CUS detectado en TransactionTermination: {cus_txt}")
                                    captured_pse_terminated.append(f"CUS:{cus_txt}")
                        except Exception:
                            pass
                    pse_page.close()
                except Exception as e_pse:
                    _log(f"Aviso durante verify_pse (no bloqueante): {e_pse}")

            # Salida ultrarrápida: si ya tenemos URL Kushki válida sin errores, no perder tiempo en screenshot ni lectura DOM
            png = None
            has_clean_kushki = (
                bool(captured_kushki_url)
                and not captured_pse_terminated
                and not captured_firebase_error
                and url_destino
                and "transactiontermination" not in url_destino.lower()
                and "starttransactionf.htm" not in url_destino.lower()
            )
            if has_clean_kushki:
                elapsed = time.time() - t_total
                _log(f"URL capturada para el frontend en {elapsed:.2f}s: {url_destino}")
                return habilitado, png, url_destino, proxy_ip_holder[0], captured_kushki_url[0]

            # Solo inspeccionar texto del DOM cuando NO hubo captura limpia de Kushki (para detectar rechazo/expiración)
            texto_pantalla = ""
            try:
                texto_pantalla = page.locator("body").inner_text()
            except Exception:
                pass

            if (
                captured_pse_terminated
                or (url_destino and ("transactiontermination" in url_destino.lower() or "starttransactionf.htm" in url_destino.lower()))
                or "transactiontermination" in (page.url or "").lower()
                or ("no se pudo realizar" in texto_pantalla.lower() and "código único" in texto_pantalla.lower())
            ):
                cus_info = next((x for x in captured_pse_terminated if str(x).startswith("CUS:")), "")
                cus_suffix = f" ({cus_info})" if cus_info else ""
                _log(f"PSE rechazó la transacción en TransactionTermination.aspx{cus_suffix}.")
                raise Exception(f"PSE_TRANSACTION_TERMINATED: PSE rechazó la transacción en TransactionTermination.aspx{cus_suffix}. El link está bloqueado.")

            if "Link de pago PSE rechazado" in texto_pantalla or "no podemos continuar con la transacción" in texto_pantalla or captured_firebase_error:
                fb_detail = captured_firebase_error[0] if captured_firebase_error else "Link de pago PSE rechazado en pantalla"
                _log(f"La pasarela RappiPay rechazó el link ({fb_detail}).")
                raise Exception(f"LINK_DEFINITIVAMENTE_BLOQUEADO: Link de pago PSE rechazado por RappiPay ({fb_detail}).")

            if "El link de pago con PSE expiró" in texto_pantalla or "este link ya no existe" in texto_pantalla.lower() or "link expirado" in texto_pantalla.lower():
                _log("La pasarela RappiPay mostró: 'El link de pago con PSE expiró'.")
                raise Exception("LINK_DEFINITIVAMENTE_BLOQUEADO: El link de pago con PSE expiró en RappiPay.")

            if not url_destino or url_destino == url_inicial or "linkdepagospse.rappipay.co" in url_destino:
                _log("No se detectó URL de redirección bancaria tras 28s de espera.")
                raise Exception(f"ERROR_TEMPORAL_REINTENTABLE: No se generó redirección bancaria tras el envío (posible latencia del proxy o banco). El link sigue activo. URL actual: {page.url}")

            elapsed = time.time() - t_total
            _log(f"URL capturada para el frontend en {elapsed:.2f}s: {url_destino}")
            kushki_url = captured_kushki_url[0] if captured_kushki_url else (url_destino if "kushkipagos.com" in url_destino else None)
            return habilitado, png, url_destino, proxy_ip_holder[0], kushki_url

        finally:
            try:
                browser.close()
            except Exception:
                pass
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