const map = L.map("map");
const marcadores = {};
let marcadorUser = null;
//map.setView([0,0],2);

const estados = {
    'vazio': { cor: 'white', label: 'Vazio' },
    'poucos': { cor: 'limegreen', label: 'Poucos Passageiros' },
    'muitos': { cor: 'gold', label: 'Muitos Passageiros' },
    'lotado': { cor: 'red', label: 'Lotado' }
};

function estadoMaisVotado(votos) {
    let max = 0, estado = 'vazio';
    for (let [k, v] of Object.entries(votos)) {
        if (v > max) {
            max = v;
            estado = k;
        }
    }

    return estados[estado];
}

function iconeOnibus(cor) {
    const html = `
        <div class="icone-onibus" style="border-color: ${cor}">
        <img src="/static/img/bus.jpg" />
        </div>
        `;

    return L.divIcon({
        html: html,
        className: "",
        iconSize: [50, 50],
        iconAnchor: [24, 25],
    });
}

function mostrarLocalizacaoUser(lat, lng) {
    if (marcadorUser) {
        marcadorUser.setLatLng([lat, lng]);
    } else {
        const html = `
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <div style="
                        background-color: #8a2be2;
                        color: white;
                        padding: 2px 6px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: bold;
                        margin-bottom: 2px;
                    ">VOCÊ</div>
                    <div style="
                        width: 14px;
                        height: 14px;
                        border-radius: 50%;
                        background-color: #8a2be2;
                    "></div>
                </div>
            `;

        marcadorUser = L.marker([lat, lng], {
            icon: L.divIcon({
                className: '',
                html: html,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).addTo(map);
    }
}

if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(
        pos => {
            const { latitude, longitude } = pos.coords;
            mostrarLocalizacaoUser(latitude, longitude);
        },
        err => {
            console.warn("Erro ao obter localização do user: ", err.message);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000
        }
    )
}

async function atualizarBusao() {
    const res = await fetch("/api/onibus");
    const dados = await res.json();

    if (!map._loaded) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                const { latitude, longitude } = pos.coords;
                map.setView([latitude, longitude], 15);
                mostrarLocalizacaoUser(latitude, longitude);
            },
            err => {
                if (dados.length > 0) {
                    const random = dados[Math.floor(Math.random() * dados.length)];
                    map.setView([random.lat, random.lng], 15);
                } else {
                    map.setView([0, 0], 2);
                }
            }
        );
    }

    dados.forEach((bus) => {
        const { id, lat, lng, rota, votos } = bus;

        const estado = estadoMaisVotado(votos || { vazio: 0, poucos: 0, muitos: 0, lotado: 0 });
        const estadoChave = Object.entries(estados).find(([key, val]) => val.label === estado.label)?.[0] || 'vazio';

        const popup = `
                <div>
                    <strong>Ônibus #${id}</strong><br>
                    Rota: ${rota.nome}<br>
                    Lotação: <span class="estado-lotacao ${estadoChave}">${estado.label}</span><br><br>
                    <button class="popup-onibus" onclick="abrirVotacao('${id}', ${lat}, ${lng})">Votar na Lotação</button>
                </div>
            `;

        if (marcadores[id]) {
            marcadores[id].setLatLng([lat, lng]);
            marcadores[id].getPopup().setContent(popup);
        } else {
            marcadores[id] = L.marker([lat, lng], {
                icon: iconeOnibus(rota.cor),
            }).bindPopup(popup).addTo(map);
        }
    });
}

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "LetsBus",
}).addTo(map);

function abrirVotacao(id, lat, lng) {
    const popup = `
            <div class="popup-onibus" style="text-align:center;">
                <h4 style="margin-bottom: 10px;">Como está a lotação do ônibus</h4>
                <div style="display: flex; flex-direction: column; gap: 5px">
                    <button onclick="enviarVoto('${id}', 'vazio')">Vazio</button>
                    <button onclick="enviarVoto('${id}', 'poucos')">Poucos passageiros</button>
                    <button onclick="enviarVoto('${id}', 'muitos')">Muitos passageiros</button>
                    <button onclick="enviarVoto('${id}', 'lotado')">Lotado</button>
                </div>
            </div>
        `;
    L.popup().setLatLng([lat, lng]).setContent(popup).openOn(map);
}

async function enviarVoto(id, voto) {
    const res = await fetch('/api/votar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, voto })
    });
    const resposta = await res.json();
    alert(resposta.status || resposta.erro);
}

atualizarBusao();
setInterval(atualizarBusao, 5000);



 // Toggle menu mobile
      const toggle = document.getElementById('nav-toggle');
      const menu = document.getElementById('nav-menu');
      const burguer = document.querySelector('.nav-burguer');
      const close = document.querySelector('.nav-close');

      toggle.addEventListener('click', () => {
        menu.classList.toggle('menu-aberto');
        const aberto = menu.classList.contains('menu-aberto');
        burguer.style.opacity = aberto ? 0 : 1;
        close.style.opacity = aberto ? 1 : 0;
      });

    //   MASCARA DE TELEFONE
    $('#reg-tel').mask('(00) 0000-0000');

