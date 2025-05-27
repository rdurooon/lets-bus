from flask import Blueprint, render_template, jsonify
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