const map = L.map("map");
const marcadores = {};
let marcadorUser = null;

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

function mostrarLocalizacaoUser(lat, lng){
    if(marcadorUser){
        marcadorUser.setLatLng([lat,lng]);
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

        marcadorUser = L.marker([lat,lng], {
            icon: L.divIcon({
                className: '',
                html: html,
                iconSize: [30,30],
                iconAnchor: [15,15]
            })
        }).addTo(map);
    }
}

if("geolocation" in navigator){
    navigator.geolocation.watchPosition(
        pos => {
            const {latitude, longitude} = pos.coords;
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
    
    if(!map._loaded){
        navigator.geolocation.getCurrentPosition(
            pos => {
                const {latitude, longitude} = pos.coords;
                map.setView([latitude, longitude], 15);
                mostrarLocalizacaoUser(latitude, longitude);
            },
            err => {
                if(dados.length > 0) {
                    const random = dados[Math.floor(Math.random() * dados.length)];
                    map.setView([random.lat, random.lng], 15);
                } else {
                    map.setView([0,0], 2);
                }
            }
        );
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

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "LetsBus",
}).addTo(map);

atualizarBusao();
setInterval(atualizarBusao, 5000);
