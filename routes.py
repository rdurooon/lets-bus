from flask import Blueprint, render_template, jsonify, request
import json
import os

routes = Blueprint('routes', __name__)
onibus_dados_path = 'data/bus.json'

def carregar_dados_onibus():
    if os.path.exists(onibus_dados_path):
        with open(onibus_dados_path, 'r') as f:
            return json.load(f)
    return []

@routes.route("/")
def main():
    return render_template("main_page.html")

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
        return jsonify({'erro': 'Dados inválido'}), 400
    
    onibus = carregar_dados_onibus()
    for bus in onibus:
        if bus['id'] == bus_id:
            if voto in bus['votos']:
                bus['votos'][voto] += 1
                with open(onibus_dados_path, 'w') as f:
                    json.dump(onibus, f, indent=4)
                return jsonify({'status': 'Voto computado'})
    return jsonify({'erro': 'Ônibus não encontrado'}), 404

@routes.route('/login')
def login():
    return render_template("loginpage.html")


@routes.route('/cadastro')
def cadastro():
    return render_template("registerpage.html")