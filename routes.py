from flask import Blueprint, render_template, jsonify, request, url_for, redirect, session
from werkzeug.security import generate_password_hash, check_password_hash
import json
import os
import hashlib
import time

routes = Blueprint('routes', __name__)

usuarios_path = os.path.join('data', 'usuarios.json')
onibus_dados_path = os.path.join('data', 'bus.json')
tokens_path = os.path.join('data', 'tokens_recuperacao.json')
paradas_path = os.path.join('data', 'paradas.json')

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

def carregar_dados_onibus():
    if os.path.exists(onibus_dados_path):
        with open(onibus_dados_path, 'r') as f:
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

# ----------- ROTAS DE PÁGINAS -----------

@routes.route("/")
def main():
    usuario = session.get('usuario')
    return render_template("main_page.html", usuario=usuario)

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

# ----------- ROTA PAINEL ADMIN -----------

@routes.route('/admin')
def painel_admin():
    usuario = session.get('usuario')
    if not usuario or not usuario.get('admin'):
        return "Acesso não autorizado", 403

    onibus = carregar_dados_onibus()
    paradas = carregar_paradas()
    usuarios = carregar_usuarios()

    return render_template("admin_page.html", usuario=usuario, onibus=onibus, paradas=paradas, usuarios=usuarios)

@routes.route('/api/admin/cadastrar_onibus', methods=['POST'])
def cadastrar_onibus():
    usuario = session.get('usuario')
    if not usuario or not usuario.get('admin'):
        return jsonify({'erro': 'Acesso não autorizado'}), 403

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
def remover_parada():
    usuario = session.get('usuario')
    if not usuario or not usuario.get('admin'):
        return jsonify({'erro': 'Acesso não autorizado'}), 403

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
