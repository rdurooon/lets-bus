from flask import Flask, jsonify, render_template
import random

app = Flask(__name__)

posicao_do_onibus = {"lat": -0.037182, "lng": -51.177509 }

@app.route("/")
def index():
    return render_template("index.html")

@app.route('/api/onibus')
def get_posicao_do_onibus():
    posicao_do_onibus["lat"] += random.uniform(-0.0005, 0.0005)
    posicao_do_onibus["lng"] += random.uniform(-0.0005, 0.0005)
    return jsonify(posicao_do_onibus)

if __name__ == '__main__':
    app.run(debug=True)
    