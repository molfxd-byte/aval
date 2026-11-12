import io
import os
import sys
import json
import base64
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


def _recv_exact(sock, n):
    buf = bytearray()
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("Socket closed prematurely")
        buf.extend(chunk)
    return bytes(buf)


def _start_local_socks5_proxy(upstream_host, upstream_port, upstream_user, upstream_pass):
    """
    Levanta un relay SOCKS5 local sin autenticación en 127.0.0.1 que reenvía
    todo el tráfico al upstream SOCKS5 de IPRoyal con credenciales.
    Chromium se conecta a 127.0.0.1 sin auth, evitando el error de compatibilidad.
    """
    def _upstream_connect(host, port, atyp):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(25)
        sock.connect((upstream_host, int(upstream_port)))

        sock.sendall(b"\x05\x02\x00\x02")
        resp = _recv_exact(sock, 2)
        if resp[1] == 0x02:
            user_b = upstream_user.encode("utf-8")
            pass_b = upstream_pass.encode("utf-8")
            sock.sendall(bytes([0x01, len(user_b)]) + user_b + bytes([len(pass_b)]) + pass_b)
            ar = _recv_exact(sock, 2)
            if ar[1] != 0x00:
                raise ConnectionError("Auth SOCKS5 upstream rechazada")
        elif resp[1] != 0x00:
            raise ConnectionError(f"Upstream rechazó métodos: {resp[1]:#x}")

        host_b = host.encode("utf-8") if isinstance(host, str) else host
        if atyp == 0x01:
            req = b"\x05\x01\x00\x01" + socket.inet_aton(host)
        elif atyp == 0x04:
            import ipaddress
            req = b"\x05\x01\x00\x04" + ipaddress.IPv6Address(host).packed
        else:
            req = b"\x05\x01\x00\x03" + bytes([len(host_b)]) + host_b
        req += port.to_bytes(2, "big")
        sock.sendall(req)

        hdr = _recv_exact(sock, 4)
        if hdr[1] != 0x00:
            raise ConnectionError(f"CONNECT upstream falló: {hdr[1]}")
        resp_atyp = hdr[3]
        if resp_atyp == 0x01:
            _recv_exact(sock, 6)
        elif resp_atyp == 0x04:
            _recv_exact(sock, 18)
        elif resp_atyp == 0x03:
            ln = _recv_exact(sock, 1)[0]
            _recv_exact(sock, ln + 2)

        sock.settimeout(None)
        return sock

    def _handle_client(cli):
        up = None
        try:
            hdr = _recv_exact(cli, 2)
            if hdr[0] != 0x05:
                return
            _recv_exact(cli, hdr[1])
            cli.sendall(b"\x05\x00")

            req = _recv_exact(cli, 4)
            cmd, atyp = req[1], req[3]
            if cmd != 0x01:
                cli.sendall(b"\x05\x07\x00\x01\x00\x00\x00\x00\x00\x00")
                return

            if atyp == 0x01:
                host = socket.inet_ntoa(_recv_exact(cli, 4))
            elif atyp == 0x03:
                ln = _recv_exact(cli, 1)[0]
                host = _recv_exact(cli, ln).decode("utf-8")
            elif atyp == 0x04:
                import ipaddress
                host = str(ipaddress.IPv6Address(_recv_exact(cli, 16)))
            else:
                return

            port = int.from_bytes(_recv_exact(cli, 2), "big")
            up = _upstream_connect(host, port, atyp)
            cli.sendall(b"\x05\x00\x00\x01\x00\x00\x00\x00\x00\x00")

            def _pipe(src, dst):
                try:
                    while True:
                        data = src.recv(65536)
                        if not data:
                            break
                        dst.sendall(data)
                except Exception:
                    pass
                finally:
                    try:
                        dst.shutdown(socket.SHUT_WR)
                    except Exception:
                        pass

            t = threading.Thread(target=_pipe, args=(cli, up), daemon=True)
            t.start()
            _pipe(up, cli)
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
    srv.listen(64)
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


def _norm(s):
    if not s:
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFD", s.lower())
        if unicodedata.category(c) != "Mn"
    ).strip()


def fill_bold(data):
    import time
    headless_mode = os.environ.get("HEADLESS", "true").lower() not in ("false", "0", "no")

    proxy_host = os.environ.get("PROXY_HOST", "").strip()
    proxy_port = os.environ.get("PROXY_PORT", "").strip()
    proxy_socks_port = os.environ.get("PROXY_SOCKS_PORT", "").strip()
    proxy_user = os.environ.get("PROXY_USERNAME", "").strip()
    proxy_pass = os.environ.get("PROXY_PASSWORD", "").strip()

    proxy_config = None
    proxy_ip = None
    _socks5_stop = None

    use_socks5 = bool(proxy_host and proxy_socks_port)
    has_proxy = proxy_host and (proxy_socks_port or proxy_port)

    if has_proxy:
        for intento in range(1, 4):
            session_id = f"bold_{int(time.time())}_{intento}"
            full_pass = f"{proxy_pass}_session-{session_id}" if proxy_pass else ""
            try:
                import requests as _req
                if use_socks5:
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
                    headers={"User-Agent": "Mozilla/5.0"}
                )
                if r.status_code == 200 and r.text.strip():
                    proxy_ip = r.text.strip()
                    _log(f"Proxy {proto_label} asignado exitosamente (intento {intento}) → IP: {proxy_ip}")

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
            _log("ADVERTENCIA: No se pudo obtener IP residencial. Continuando conexión directa.")
    else:
        _log("Sin proxy configurado, conexión directa.")

    target_url = data.get("url") or os.environ.get("PAYMENT_BOLD_URL", "").strip() or "https://checkout.bold.co/payment/LNK_6QLA1TDHVF"

    with sync_playwright() as p:
        launch_args = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
        ]
        browser = p.chromium.launch(
            headless=headless_mode,
            args=launch_args,
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 1000},
            proxy=proxy_config,
            ignore_https_errors=True,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

        intercepted_checkout = {}
        captured_pse_url = []

        def _on_request(req):
            if "registro.pse.com.co" in req.url or "pse.com.co" in req.url:
                if req.url not in captured_pse_url:
                    captured_pse_url.append(req.url)
                    _log(f"URL bancaria interceptada en peticiones: {req.url}")

        def _on_response(res):
            if "payment/checkout" in res.url:
                try:
                    intercepted_checkout["status"] = res.status
                    intercepted_checkout["data"] = res.json()
                    _log(f"API checkout interceptado status={res.status}: {intercepted_checkout['data']}")
                except Exception:
                    pass

        page.on("request", _on_request)
        page.on("response", _on_response)

        try:
            _log(f"Navegando a Bold: {target_url}")
            page.goto(target_url, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(2500)

            # 1. Ingresar Monto
            clean_monto = str(data["monto"]).replace(".", "").replace(",", "").replace("$", "").strip()
            _log(f"Ingresando monto: ${clean_monto}")
            inp_monto = page.locator('input[placeholder="$0"]').first
            inp_monto.wait_for(state="visible", timeout=15000)
            inp_monto.click()
            inp_monto.fill(clean_monto)
            page.wait_for_timeout(1000)

            # 2. Seleccionar PSE
            _log("Seleccionando medio de pago PSE...")
            pse_btn = page.locator('button:has(p:text-is("PSE")), p:text-is("PSE")').first
            pse_btn.click()
            page.wait_for_timeout(2000)

            # 3. Llenar Celular
            celular = str(data.get("celular") or data.get("phone") or "3101234567").strip()
            cel_input = page.locator('input[name="phoneData"], input[type="tel"]').first
            if cel_input.is_visible():
                cel_input.fill(celular)
                _log(f"Celular ingresado: {celular}")

            # 4. Llenar Nombre
            nombre = str(data.get("nombre") or data.get("name") or "Cliente").strip()
            name_input = page.locator('input[name="name"], #et_payer_name').first
            if name_input.is_visible():
                name_input.fill(nombre)
                _log(f"Nombre ingresado: {nombre}")

            # 5. Llenar Correo
            correo = str(data.get("email") or data.get("correo") or "cliente@gmail.com").strip()
            email_input = page.locator('input[name="email"], #et_payer_email').first
            if email_input.is_visible():
                email_input.fill(correo)
                _log(f"Correo ingresado: {correo}")

            # 6. Documento
            doc = str(data["doc"]).strip()
            doc_input = page.locator('input[name*="identificationNumber"], #et_payer_identification_number').first
            if doc_input.is_visible():
                doc_input.fill(doc)
                _log(f"Documento ingresado: {doc}")

            # 7. Seleccionar Banco
            banco_buscado = str(data.get("banco", "Bancolombia")).strip()
            _log(f"Buscando banco: {banco_buscado}")
            bank_trigger = page.locator('text="Selecciona el banco o billetera digital"').first
            try:
                bank_trigger.click(timeout=8000)
                page.wait_for_timeout(600)

                search_inp = page.locator('input[name="search"], input[placeholder*="Buscar"]').first
                if search_inp.is_visible():
                    search_inp.fill(banco_buscado)
                    page.wait_for_timeout(600)

                banco_opt = page.locator(f'p:has-text("{banco_buscado}"), span:has-text("{banco_buscado}")').first
                if banco_opt.is_visible():
                    banco_opt.click()
                    _log(f"Banco seleccionado: {banco_buscado}")
                else:
                    first_opt = page.locator('p[class*="Caption"], p.color-black-100').first
                    first_opt.click()
                    _log("Primer banco de la lista seleccionado")
            except Exception as e:
                _log(f"Aviso seleccionando banco: {e}")

            # 8. Dirección
            dir_input = page.locator('input[name="address"], #et_payer_address').first
            if dir_input.is_visible():
                dir_val = str(data.get("direccion") or "Calle 10 # 20-30").strip()
                dir_input.fill(dir_val)
                _log(f"Dirección ingresada: {dir_val}")

            page.wait_for_timeout(1000)

            # 9. Clic en "Ir a PSE"
            _log("Enviando formulario 'Ir a PSE'...")
            initial_url = page.url
            try:
                btn_direct = page.locator('bold-button:has-text("Ir a PSE"), button:has-text("Ir a PSE")').first
                if btn_direct.is_visible():
                    btn_direct.click()
            except Exception:
                pass

            page.evaluate("""() => {
                const bb = document.querySelector('bold-button[class*="payButton"], bold-button');
                if (bb) {
                    const shadowBtn = bb.shadowRoot ? bb.shadowRoot.querySelector('button') : bb.querySelector('button');
                    if (shadowBtn) shadowBtn.click();
                    else bb.click();
                }
            }""")

            # 10. Esperar URL de redirección bancaria o respuesta de la API
            redirect_url = None
            for seg in range(30):
                page.wait_for_timeout(1000)

                # A) Redirección interceptada en peticiones de red
                if captured_pse_url:
                    redirect_url = captured_pse_url[0]
                    _log(f"Redirección capturada desde petición de red: {redirect_url}")
                    break

                # B) Redirección en la página principal
                if page.url != initial_url and "bold.co/payment" not in page.url:
                    redirect_url = page.url
                    _log(f"Redirección bancaria capturada: {redirect_url}")
                    break

                # C) Redirección en pestaña nueva
                if len(context.pages) > 1:
                    new_tab = context.pages[-1]
                    if "bold.co" not in new_tab.url:
                        redirect_url = new_tab.url
                        _log(f"Redirección capturada en nueva pestaña: {redirect_url}")
                        break

                # D) Capturada desde el payload de la API de Bold
                if intercepted_checkout:
                    data_resp = intercepted_checkout.get("data", {})
                    payload_resp = data_resp.get("payload", {})
                    candidate_url = (
                        payload_resp.get("redirect_url")
                        or payload_resp.get("url")
                        or payload_resp.get("bank_url")
                        or payload_resp.get("next_actions", {}).get("redirect_url")
                    )
                    if candidate_url:
                        redirect_url = candidate_url
                        _log(f"URL capturada desde respuesta de Bold API: {redirect_url}")
                        break

            # Si no hubo redirección bancaria externa, revisar el mensaje en pantalla
            if not redirect_url or "bold.co" in redirect_url:
                body_txt = page.locator("body").inner_text()
                if "Algo salió mal" in body_txt or "No se pudo crear la transacción" in body_txt:
                    raise Exception("Bold rechazó la transacción: 'No se pudo crear la transacción'. Verifique los datos o el estado de la cuenta en Bold.")

                # Si está en la pantalla 'Estás yendo a PSE'
                if "Estás yendo a PSE" in body_txt:
                    _log("Pantalla de transición a PSE activa.")

            png = page.screenshot(full_page=True)

            final_dest = redirect_url or page.url
            _log(f"URL destino final: {final_dest}")
            return True, png, final_dest, proxy_ip

        finally:
            browser.close()
    if _socks5_stop:
        _socks5_stop.set()


if __name__ == "__main__":
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            data = {
                "monto": "20000",
                "banco": "BANCOLOMBIA",
                "tipo": "Cédula de ciudadania",
                "doc": "1018475839",
                "nombre": "CARLOS PEREZ",
                "email": "carlosperez@gmail.com",
                "celular": "3101234567",
            }
        else:
            data = json.loads(raw_input)

        enabled, png, redirect_url, proxy_ip = fill_bold(data)

        result = {
            "enabled": enabled,
            "png": base64.b64encode(png).decode() if png else None,
            "redirect_url": redirect_url,
            "proxy_ip": proxy_ip,
        }
        print("---JSON_START---")
        print(json.dumps(result))
        print("---JSON_END---")
        sys.stdout.flush()

    except Exception as e:
        _log(f"Error: {e}")
        sys.exit(1)
