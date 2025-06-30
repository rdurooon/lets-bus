from functools import wraps
from flask import Blueprint, render_template, jsonify, request, send_from_directory, url_for, redirect, session
import pandas as pd
import requests
from werkzeug.security import generate_password_hash, check_password_hash
import json
import os
import hashlib
import time
import traceback
import math

routes = Blueprint('routes', __name__)

usuarios_path = os.path.join('data', 'usuarios.json')
onibus_dados_path = os.path.join('data', 'bus.json')
tokens_path = os.path.join('data', 'tokens_recuperacao.json')
paradas_path = os.path.join('data', 'paradas.json')
imei_id_path = os.path.join('data', 'imei_id.json')


# ---------------- RE-ROTAS ----------------
@routes.before_request
def redirect_to_https():
    if request.headers.get('X-Forwarded-Proto', 'http') == 'http':
        url = request.url.replace('http://', 'https://', 1)
        return redirect(url, code=301)

# ----------- FUNÇÕES AUXILIARES -----------
def carregar_usuarios():
    if os.path.exists(usuarios_path):
        with open(usuarios_path, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []

def salvar_usuarios(lista_usuarios):
    with open(usuarios_path, 'w') as f:
        json.dump(lista_usuarios, f, indent=2)

def salvar_dados_onibus(dados):
    for bus in dados:
        rota = bus.get('rota', {})
        coords = rota.get('coords')
        if isinstance(coords, list):
            coords = arredondar_coordenadas(coords)
            coords = simplificar_rota(coords, tolerancia=0.0005)
            rota['coords'] = coords
    with open(onibus_dados_path, 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)

def carregar_dados_onibus():
    if os.path.exists(onibus_dados_path):
        with open(onibus_dados_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def carregar_tokens():
    if os.path.exists(tokens_path):
        with open(tokens_path, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}

def salvar_tokens(dados):
    with open(tokens_path, 'w') as f:
        json.dump(dados, f, indent=2)

def gerar_token(email):
    timestamp = str(time.time())
    raw = email + timestamp
    token = hashlib.sha256(raw.encode()).hexdigest()
    return token

def carregar_paradas():
    if os.path.exists(paradas_path):
        with open(paradas_path, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []

def salvar_paradas(lista_paradas):
    with open(paradas_path, 'w') as f:
        json.dump(lista_paradas, f, indent=2)

def carregar_imei_id():
    if os.path.exists(imei_id_path):
        with open(imei_id_path, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}

def salvar_imei_id(dados):
    with open(imei_id_path, 'w') as f:
        json.dump(dados, f, indent=2)

def remover_imei_id(imei):
    with open(imei_id_path, 'r') as f:
        dados = json.load(f)

    if imei in dados:
        del dados[imei]

        with open(imei_id_path, 'w') as f:
            json.dump(dados, f)

    else:
        raise ValueError("IMEI não encontrado")

# ------------- FUNÇÕES SOBRE ROTAS DOS ONIBUS ----------------
def arredondar_coordenadas(coordenadas):
    return [[round(lat, 4), round(lon, 4)] for lat, lon in coordenadas]

def simplificar_rota(coordenadas, tolerancia=0.0005):
    # algoritmo Douglas–Peucker
    from math import hypot
    def perp_dist(p, p1, p2):
        (x, y), (x1,y1), (x2,y2) = p, p1, p2
        num = abs((y2-y1)*x - (x2-x1)*y + x2*y1 - y2*x1)
        den = hypot(y2-y1, x2-x1)
        return num/den if den else hypot(x-x1, y-y1)

    def dp(pts):
        if len(pts) < 3: return pts
        maxd, idx = 0, 0
        for i in range(1, len(pts)-1):
            d = perp_dist(pts[i], pts[0], pts[-1])
            if d > maxd:
                maxd, idx = d, i
        if maxd > tolerancia:
            L = dp(pts[:idx+1])
            R = dp(pts[idx:])
            return L[:-1] + R
        else:
            return [pts[0], pts[-1]]
    return dp(coordenadas)

def buscar_coordenadas_possiveis(rua, cidade='Santana', estado='Amapá', limite=5):
    url = 'https://nominatim.openstreetmap.org/search'
    tentativas = [
        f'{rua}, {cidade}, {estado}, Brasil',
        f'{rua}, {estado}, Brasil',
        f'{rua}'
    ]
    headers = {'User-Agent': 'LetsBus'}

    for query in tentativas:
        try:
            params = {'q': query, 'format': 'json', 'limit': limite}
            resposta = requests.get(url, params=params, headers=headers, timeout=5)
            dados = resposta.json()
            if dados:
                resultados = []
                for d in dados:
                    lat = float(d['lat'])
                    lon = float(d['lon'])
                    resultados.append((lat, lon))
                return resultados
        except Exception:
            continue
    return []

def distancia_pontos(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

def escolher_melhor_rota(ruas):
    lista_opcoes = [buscar_coordenadas_possiveis(rua) for rua in ruas]

    for idx, opcoes in enumerate(lista_opcoes):
        if not opcoes:
            return None, f"Não há opções para a rua: {ruas[idx]}"

    rota_final = []
    rota_final.append(lista_opcoes[0][0])

    for i in range(1, len(lista_opcoes)):
        opcoes_proxima_rua = lista_opcoes[i]

        melhor_par = None
        menor_distancia = float('inf')
        ponto_atual = rota_final[-1]

        for opc_prox in opcoes_proxima_rua:
            dist = distancia_pontos(ponto_atual, opc_prox)
            if dist < menor_distancia:
                menor_distancia = dist
                melhor_par = opc_prox

        if melhor_par:
            rota_final.append(melhor_par)
        else:
            rota_final.append(opcoes_proxima_rua[0])

    return rota_final, None

def buscar_coordenada(rua, cidade='Santana', estado='Amapá'):
    url = 'https://nominatim.openstreetmap.org/search'

    tentativas = [
        f'{rua}, {cidade}, {estado}, Brasil',
        f'{rua}, {estado}, Brasil',
        f'{rua}'
    ]

    headers = {'User-Agent': 'LetsBus'}

    for query in tentativas:
        try:
            params = {'q': query, 'format': 'json', 'limit': 1}
            resposta = requests.get(url, params=params, headers=headers, timeout=5)
            dados = resposta.json()
            if dados:
                lat = float(dados[0]['lat'])
                lon = float(dados[0]['lon'])
                return lat, lon
        except Exception:
            continue

    return None

def obter_rota_osrm(origem, destino):
    url = f'http://router.project-osrm.org/route/v1/driving/{origem[1]},{origem[0]};{destino[1]},{destino[0]}?overview=full&geometries=geojson'
    try:
        r = requests.get(url, timeout=10)
        data = r.json()
        if 'routes' in data and data['routes']:
            return data['routes'][0]['geometry']['coordinates']  # [lng, lat]
    except Exception as e:
        print(f"Erro ao buscar rota OSRM: {e}")
    return None

# ----------- ROTAS DE PÁGINAS -----------
@routes.route("/")
def main():
    usuario = session.get('usuario')
    user_role = False
    if usuario:
        user_role = usuario.get('admin', False)
    return render_template("main_page.html", usuario=usuario, user_role=user_role)

@routes.route("/login")
def login():
    return render_template("loginpage.html")

@routes.route("/cadastro")
def cadastro():
    return render_template("registerpage.html")

@routes.route('/logout')
def logout():
    session.pop('usuario', None)
    return render_template("main_page.html", usuario=None)

@routes.route("/recuperar", methods=["GET", "POST"])
def solicitar_recuperacao():
    if request.method == "POST":
        email = request.form.get("email", "").strip()
        usuarios = carregar_usuarios()

        for user in usuarios:
            if user['email'] == email:
                token = gerar_token(email)
                tokens = carregar_tokens()
                tokens[token] = {
                    'email': email,
                    'expira_em': time.time() + 3600
                }
                salvar_tokens(tokens)
                return redirect(url_for('routes.redefinir_senha', token=token))

        return render_template("recuperar_senha.html", mensagem="Email não encontrado.")

    return render_template("recuperar_senha.html")

@routes.route("/recuperar/<token>", methods=["GET", "POST"])
def redefinir_senha(token):
    tokens = carregar_tokens()
    dados_token = tokens.get(token)

    if not dados_token or time.time() > dados_token['expira_em']:
        return "Token expirado ou inválido.", 400

    if request.method == "POST":
        nova = request.form.get("nova_senha")
        confirmar = request.form.get("confirmar_senha")

        if nova != confirmar:
            return render_template("nova_senha.html", token=token, mensagem="As senhas não coincidem.")

        usuarios = carregar_usuarios()
        for user in usuarios:
            if user['email'] == dados_token['email']:
                user['senha'] = generate_password_hash(nova)
                salvar_usuarios(usuarios)
                del tokens[token]
                salvar_tokens(tokens)
                return redirect(url_for('routes.login'))

        return "Usuário não encontrado.", 404

    return render_template("nova_senha.html", token=token)

# ----------- API: DADOS DOS ÔNIBUS -----------

@routes.route('/api/onibus')
def api_onibus():
    dados = carregar_dados_onibus()
    return jsonify(dados)

@routes.route('/api/set_visibility', methods=['POST'])
def set_visibility():
    data = request.get_json()
    bus_id = str(data.get('id'))
    visivel = data.get('visivel')

    with open(onibus_dados_path, 'r') as f:
        dados = json.load(f)

    onibus_encontrado = False
    for bus in dados:
        if str(bus.get('id')) == bus_id:
            bus['visivel'] = visivel
            onibus_encontrado = True
            break

    if not onibus_encontrado:
        return jsonify({'erro': 'ID do ônibus não encontrado'}), 404

    with open(onibus_dados_path, 'w') as f:
        json.dump(dados, f, indent=2)

    return jsonify({'ok': True})

@routes.route('/api/imei_id', methods=['GET'])
def listar_imei_id():
    dados = carregar_imei_id()
    return jsonify(dados)

@routes.route('/api/salvar_imei', methods=['POST'])
def salvar_imei():
    data = request.get_json()
    imei = data.get('imei', '').strip()
    bus_id = data.get('id')

    if not imei or not bus_id:
        return jsonify({'error': 'IMEI ou ID do ônibus não fornecidos'}), 400

    try:
        bus_id = int(bus_id)
    except ValueError:
        return jsonify({'error': 'ID do ônibus inválido'}), 400

    onibus = carregar_dados_onibus()
    existe_onibus = any(str(bus['id']) == str(bus_id) for bus in onibus)

    if not existe_onibus:
        return jsonify({'error': f'Ônibus com ID {bus_id} não encontrado.'}), 404

    mappings = carregar_imei_id()
    mappings[imei] = bus_id

    try:
        salvar_imei_id(mappings)
        return jsonify({'status': 'IMEI vinculado ao ônibus com sucesso.'})
    except Exception as e:
        print("Erro ao salvar IMEI:", e)
        return jsonify({'error': 'Erro ao salvar o mapeamento.'}), 500

@routes.route('/api/remover_imei', methods=['POST'])
def remover_imei():
    data = request.json
    imei = data.get('imei')
    if not imei:
        return jsonify({'error': 'IMEI não fornecido'}), 400
    try:
        remover_imei_id(imei)
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@routes.route('/api/votar', methods=['POST'])
def votar():
    data = request.json
    bus_id = data.get('id')
    voto = data.get('voto')

    if not bus_id or not voto:
        return jsonify({'erro': 'Dados inválidos'}), 400

    onibus = carregar_dados_onibus()
    for bus in onibus:
        if bus['id'] == bus_id:
            if voto in bus['votos']:
                bus['votos'][voto] += 1
                with open(onibus_dados_path, 'w') as f:
                    json.dump(onibus, f, indent=4)
                return jsonify({'status': 'Voto computado'})
    return jsonify({'erro': 'Ônibus não encontrado'}), 404

@routes.route('/api/imei_id', methods=['POST'])
def get_id_by_imei():
    imei_data = request.get_json()

    if not imei_data or 'imei' not in imei_data:
        return jsonify({'error': 'IMEI não fornecido'}), 400

    imei = imei_data['imei']

    imei_file = 'data/imei_id.json'
    if not os.path.exists(imei_file):
        return jsonify({'error': 'Arquivo IMEI não encontrado'}), 500

    with open(imei_file, 'r') as f:
        imei_map = json.load(f)

    bus_id = imei_map.get(imei)

    if not bus_id:
        return jsonify({'error': 'IMEI não cadastrado'}), 404

    return jsonify({'id': bus_id})

# ----------- API: LOGIN / CADASTRO -----------

@routes.route('/api/cadastro', methods=['POST'])
def cadastrar_usuario():
    dados = request.get_json()
    if not all(k in dados for k in ['nome', 'telefone', 'email', 'senha']):
        return jsonify({'status': 'erro', 'mensagem': 'Dados incompletos'}), 400

    usuarios = carregar_usuarios()

    if any(u['email'] == dados['email'] for u in usuarios):
        return jsonify({'status': 'erro', 'mensagem': 'Email já cadastrado'}), 400

    novo_usuario = {
        'nome': dados['nome'],
        'telefone': dados['telefone'],
        'email': dados['email'],
        'senha': generate_password_hash(dados['senha']),
        'favoritos': [],
        'paradas_cadastradas': [],
        'admin': dados.get('admin', False)
    }

    usuarios.append(novo_usuario)
    salvar_usuarios(usuarios)
    return jsonify({'status': 'sucesso'})

@routes.route('/api/login', methods=['POST'])
def fazer_login():
    dados = request.get_json()
    usuarios = carregar_usuarios()

    for usuario in usuarios:
        if usuario['email'] == dados['email'] and check_password_hash(usuario['senha'], dados['senha']):
            session['usuario'] = {
                'nome': usuario['nome'],
                'email': usuario['email'],
                'admin': usuario.get('admin', False)
            }
            return jsonify({'status': 'sucesso'})
    return jsonify({'status': 'erro', 'mensagem': 'Email ou senha inválidos'}), 401

# ----------- API: PARADAS E FAVORITOS (NOVAS ROTAS) -----------

@routes.route('/api/cadastrar_parada', methods=['POST'])
def cadastrar_parada():
    if 'usuario' not in session:
        return jsonify({'erro': 'Usuário não autenticado'}), 401

    dados = request.get_json()
    nome = dados.get('nome')
    localizacao = dados.get('localizacao')

    if not nome or not localizacao:
        return jsonify({'erro': 'Nome e localização são obrigatórios'}), 400

    paradas = carregar_paradas()
    nova_parada = {
        "id": len(paradas) + 1,
        "nome": nome,
        "localizacao": localizacao,
        "criado_por": session['usuario']['email']
    }

    paradas.append(nova_parada)
    salvar_paradas(paradas)

    usuarios = carregar_usuarios()
    for u in usuarios:
        if u['email'] == session['usuario']['email']:
            u.setdefault("paradas_cadastradas", []).append(nova_parada["id"])
            break
    salvar_usuarios(usuarios)

    return jsonify({'status': 'Parada cadastrada com sucesso'})

@routes.route('/api/favoritar_parada', methods=['POST'])
def favoritar_parada():
    if 'usuario' not in session:
        return jsonify({'erro': 'Usuário não autenticado'}), 401

    dados = request.get_json()
    parada_id = dados.get('parada_id')

    if parada_id is None:
        return jsonify({'erro': 'ID da parada não fornecido'}), 400

    usuarios = carregar_usuarios()
    for u in usuarios:
        if u['email'] == session['usuario']['email']:
            favoritos = u.setdefault("favoritos", [])
            if parada_id in favoritos:
                favoritos.remove(parada_id)
                acao = "removido"
            else:
                favoritos.append(parada_id)
                acao = "adicionado"
            break
    salvar_usuarios(usuarios)

    return jsonify({'status': f'Favorito {acao} com sucesso'})

# ----------- API: ATUALIZAR ÔNIBUS -----------

@routes.route('/api/update_bus', methods=['POST'])
def update_bus():
    dados = request.get_json()
    bus_id = dados.get('id')
    nova_rota = dados.get('rota')

    if not bus_id or not nova_rota:
        return jsonify({'erro': 'Dados inválidos'}), 400

    onibus = carregar_dados_onibus()
    for bus in onibus:
        if bus['id'] == bus_id:
            bus['rota']['nome'] = nova_rota
            with open(onibus_dados_path, 'w') as f:
                json.dump(onibus, f, indent=4)
            return jsonify({'status': 'Ônibus atualizado com sucesso'})

    return jsonify({'erro': 'Ônibus não encontrado'}), 404

@routes.route('/api/update_location', methods=['POST','GET'])
def update_location():
    if request.method == 'GET':
        bus_id = request.args.get('id')
        lat = request.args.get('lat')
        lng = request.args.get('lng')
    else:
        data = request.get_json()
        bus_id = data.get('id')
        lat = data.get('lat')
        lng = data.get('lng')
    print(f"Recebido: id={bus_id}, lat={lat}, lng={lng}")

    if not bus_id or lat is None or lng is None:
        return jsonify({'erro':'Dados imcompletos'}), 400
    
    onibus = carregar_dados_onibus()
    for bus in onibus:
        if bus['id'] == bus_id:
            bus['lat'] = lat
            bus['lng'] = lng
            with open(onibus_dados_path, 'w') as f:
                json.dump(onibus, f, indent=4)
            return jsonify({'status':'Localização atualizada com sucesso'})
    return jsonify({'erro':'Onibus não encontrado'}),404

@routes.route('/api/update_location_url', methods=['GET'])
def update_location_url():
    bus_id = request.args.get('id')
    lat = request.args.get('lat')
    lng = request.args.get('lng')

    if not bus_id or lat is None or lng is None:
        return jsonify({'erro': 'Parâmetros ausentes ou inválidos'}), 400

    try:
        lat = float(lat)
        lng = float(lng)
    except ValueError:
        return jsonify({'erro': 'Latitude ou longitude inválidas'}), 400

    onibus = carregar_dados_onibus()
    for bus in onibus:
        if bus['id'] == bus_id:
            bus['lat'] = lat
            bus['lng'] = lng
            with open(onibus_dados_path, 'w') as f:
                json.dump(onibus, f, indent=4)
            return jsonify({'status': 'Localização atualizada com sucesso'})

    return jsonify({'erro': 'Ônibus não encontrado'}), 404

# ----------- API: ID ONIBUS POR IMEI -----------------
@routes.route('/api/imei_bus_id', methods=['GET'])
def api_imei_bus_id():
    imei = request.args.get('imei')
    if not imei:
        return jsonify({'error': 'IMEI não fornecido'}), 400
    
    mappings = carregar_imei_id()
    bus_id = mappings.get(imei)

    if bus_id is None:
        return jsonify({'error': 'IMEI não encontrado'}), 404
    
    return jsonify({'bus_id': bus_id})

# ----------- ROTA PAINEL ADMIN -----------
def admin_required(f):
    @wraps(f)
    def decoreted_function(*args, **kwargs):
        usuario = session.get('usuario')
        if not usuario or not usuario.get('admin'):
            return "Acesso não autorizado!", 403
        return f(*args, **kwargs)
    return decoreted_function

@routes.route('/admin', methods=['GET', 'POST'])
@admin_required
def painel_admin():
    usuario = session.get('usuario')
    onibus = carregar_dados_onibus()
    paradas = carregar_paradas()
    usuarios = carregar_usuarios()
    mappings = carregar_imei_id()  # dict {imei: bus_id}

    mensagem_sucesso = None
    mensagem_erro = None

    if request.method == 'POST':
        imei_remover = request.form.get('imei_remover')
        if imei_remover:
            if imei_remover in mappings:
                try:
                    del mappings[imei_remover]
                    salvar_imei_id(mappings)
                    mensagem_sucesso = f"Dispositivo com IMEI {imei_remover} removido com sucesso."
                except Exception as e:
                    mensagem_erro = "Erro ao remover o dispositivo."
                    print("Erro ao remover IMEI map:", e)
                    traceback.print_exc()
            else:
                mensagem_erro = f"IMEI {imei_remover} não encontrado."
        else:
            imei = request.form.get('imei', '').strip()
            bus_id_str = request.form.get('bus_id', '').strip()

            if not imei or not bus_id_str.isdigit():
                mensagem_erro = "IMEI inválido ou ID do ônibus inválido."
            else:
                bus_id = int(bus_id_str)
                existe_onibus = any(str(bus['id']) == str(bus_id) for bus in onibus)
                if not existe_onibus:
                    mensagem_erro = f"Ônibus com ID {bus_id} não encontrado."
                else:
                    mappings[imei] = bus_id
                    try:
                        salvar_imei_id(mappings)
                        mensagem_sucesso = f"IMEI '{imei}' vinculado ao ônibus {bus_id} com sucesso."
                    except Exception as e:
                        mensagem_erro = "Erro ao salvar o mapeamento."
                        print("Erro ao salvar IMEI map:", e)
                        traceback.print_exc()

    return render_template(
        "admin_page.html",
        usuario=usuario,
        onibus=onibus,
        paradas=paradas,
        usuarios=usuarios,
        mappings=mappings,
        mensagem_sucesso=mensagem_sucesso,
        mensagem_erro=mensagem_erro
    )

@routes.route('/api/admin/cadastrar_onibus', methods=['POST'])
@admin_required
def cadastrar_onibus():
    dados = request.get_json()
    if not all(k in dados for k in ['id', 'lat', 'lng', 'rota']):
        return jsonify({'erro': 'Dados incompletos'}), 400

    onibus = carregar_dados_onibus()

    if any(bus['id'] == dados['id'] for bus in onibus):
        return jsonify({'erro': 'ID de ônibus já existente'}), 400

    novo = {
        'id': dados['id'],
        'lat': dados['lat'],
        'lng': dados['lng'],
        'rota': dados['rota'],
        'votos': {'vazio': 0, 'poucos': 0, 'muitos': 0, 'lotado': 0}
    }

    onibus.append(novo)
    with open(onibus_dados_path, 'w') as f:
        json.dump(onibus, f, indent=4)

    return jsonify({'status': 'Ônibus cadastrado com sucesso'})

@routes.route('/api/admin/remover_parada', methods=['POST'])
@admin_required
def remover_parada():

    dados = request.get_json()
    parada_id = dados.get('parada_id')
    if parada_id is None:
        return jsonify({'erro': 'ID da parada não fornecido'}), 400

    paradas = carregar_paradas()
    paradas = [p for p in paradas if p.get('id') != parada_id]
    salvar_paradas(paradas)

    usuarios = carregar_usuarios()
    for u in usuarios:
        u['favoritos'] = [pid for pid in u.get('favoritos', []) if pid != parada_id]
        u['paradas_cadastradas'] = [pid for pid in u.get('paradas_cadastradas', []) if pid != parada_id]
    salvar_usuarios(usuarios)

    return jsonify({'status': 'Parada removida com sucesso'})

uplod_xls = 'data/rotas'
os.makedirs(uplod_xls, exist_ok=True)

@routes.route('/api/upload_rota_xls', methods=['POST'])
def upload_rota_xls():
    file = request.files.get('file')
    bus_id = request.form.get('bus_id')

    if not file or not bus_id:
        return jsonify({'error': 'Arquivo e ID do ônibus são obrigatórios'}), 400

    try:
        df = pd.read_excel(file, header=None)
        ruas = df.iloc[:, 0].dropna().tolist()

        coords, erro = escolher_melhor_rota(ruas)
        if erro:
            return jsonify({'error': erro}), 400

        rota_coords = []
        falhas_osrm = []

        for i in range(len(coords) - 1):
            origem = coords[i]
            destino = coords[i + 1]

            onibus_dados_path = obter_rota_osrm(origem, destino)
            if onibus_dados_path:
                rota_coords.extend([[lat, lng] for lng, lat in onibus_dados_path])
            else:
                print(f"Falha na rota OSRM entre pontos {origem} e {destino}, adicionando linha reta.")
                falhas_osrm.append({'de': origem, 'para': destino})
                rota_coords.append(origem)
                rota_coords.append(destino)

        if not rota_coords:
            return jsonify({'error': 'Não foi possível gerar rota com OSRM'}), 400

        onibus = carregar_dados_onibus()
        atualizado = False
        for bus in onibus:
            if bus['id'] == bus_id:
                bus.setdefault('rota', {})
                bus['rota']['coords'] = rota_coords
                atualizado = True
                break

        if not atualizado:
            return jsonify({'error': 'Ônibus com ID informado não encontrado'}), 404

        salvar_dados_onibus(onibus)

        with open(f'data/rota_{bus_id}.json', 'w', encoding='utf-8') as f:
            json.dump(ruas, f, ensure_ascii=False, indent=2)

        return jsonify({
            'success': True,
            'total_ruas': len(ruas),
            'coordenadas_encontradas': len(coords),
            'falhas_rota_osrm': falhas_osrm,
            'ruas_sem_coordenada': [], 
            'coords': rota_coords,
            'mensagem': f'Rota atualizada para ônibus {bus_id} com {len(coords)} pontos de rota.'
        }), 200

    except Exception as e:
        print("=== ERRO NO /api/upload_rota_xls ===")
        traceback.print_exc()
        return jsonify({'error': 'Erro interno no servidor'}), 500