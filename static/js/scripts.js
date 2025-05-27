const map = L.map("map");
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "LetsBus",
}).addTo(map);

const marcadores = {};

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

let primeiraAtt = true;

async function atualizarBusao() {
    const res = await fetch("/api/onibus");
    const dados = await res.json();

    if (dados.length > 0 && primeiraAtt) {
        const random = dados[Math.floor(Math.random() * dados.length)];
        map.setView([random.lat, random.lng], 15);
        primeiraAtt = false;
    }

    dados.forEach((bus) => {
        const { id, lat, lng, rota } = bus;

        if (marcadores[id]) {
            marcadores[id].setLatLng([lat, lng]);
        } else {
            marcadores[id] = L.marker([lat, lng], {
                icon: iconeOnibus(rota.cor),
            }).addTo(map);
        }
    });
}

atualizarBusao();
setInterval(atualizarBusao, 5000);
