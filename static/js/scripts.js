let map;

document.addEventListener("DOMContentLoaded", () => {
  const mapElement = document.getElementById("map");

  if (mapElement) {
    map = L.map("map");

    let rotaAtivaPolyline = null;

    function desenharRota(coords, cor) {
      if (rotaAtivaPolyline) {
        rotaAtivaPolyline.remove();
      }
      rotaAtivaPolyline = L.polyline(coords, { color: cor, weight: 5, opacity: 0.7 }).addTo(map);
    }

    const tileLayerLight = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "LetsBus",
    });

    const tileLayerDark = L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
    });

    tileLayerLight.addTo(map);

    // Controle de troca de tema (claro/escuro)
    const toggleButton = L.control({ position: 'topright' });
    toggleButton.onAdd = function () {
      const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
      div.style.backgroundColor = 'white';
      div.style.padding = '5px';
      div.style.cursor = 'pointer';
      div.style.fontSize = '14px';
      div.style.fontWeight = 'bold';
      div.style.textAlign = 'center';
      div.title = "Alternar modo claro/escuro";
      div.innerHTML = '🌙';

      div.onclick = function () {
        if (map.hasLayer(tileLayerLight)) {
          map.removeLayer(tileLayerLight);
          tileLayerDark.addTo(map);
          div.innerHTML = '☀️';
        } else {
          map.removeLayer(tileLayerDark);
          tileLayerLight.addTo(map);
          div.innerHTML = '🌙';
        }
      };
      return div;
    };
    toggleButton.addTo(map);

    const marcadores = {};
    let marcadorUser = null;

    let marcadorSelecionadoId = null;

    function limparSelecaoOnibus() {
      marcadorSelecionadoId = null;
      if (rotaAtivaPolyline) {
        rotaAtivaPolyline.remove();
        rotaAtivaPolyline = null;
      }
    }

    function limparSelecaoOnibus() {
      marcadorSelecionadoId = null;
      if (rotaAtivaPolyline) {
        rotaAtivaPolyline.remove();
        rotaAtivaPolyline = null;
      }
    }

    map.on('click', () => {
      limparSelecaoOnibus();
    });

    function estadoMaisVotado(votos) {
      const estados = {
        'vazio': { cor: 'white', label: 'Vazio' },
        'poucos': { cor: 'limegreen', label: 'Poucos Passageiros' },
        'muitos': { cor: 'gold', label: 'Muitos Passageiros' },
        'lotado': { cor: 'red', label: 'Lotado' }
      };

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
      const html = `<div class="icone-onibus" style="border-color: ${cor}"><img src="/static/img/bus.jpg" /></div>`;
      return L.divIcon({ html, className: "", iconSize: [50, 50], iconAnchor: [24, 25] });
    }

    async function atualizarBusao() {
      const res = await fetch("/api/onibus");
      const dados = await res.json();

      if (!map._loaded) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            map.setView([pos.coords.latitude, pos.coords.longitude], 15);
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
        const estadoChave = Object.entries({
          'vazio': { cor: 'white', label: 'Vazio' },
          'poucos': { cor: 'limegreen', label: 'Poucos Passageiros' },
          'muitos': { cor: 'gold', label: 'Muitos Passageiros' },
          'lotado': { cor: 'red', label: 'Lotado' }
        }).find(([key, val]) => val.label === estado.label)?.[0] || 'vazio';

        const popup = `
          <div>
            <strong>Ônibus #${id}</strong><br>
            Rota: ${decodeUtf8(rota.nome)}<br>
            Lotação: <span class="estado-lotacao ${estadoChave}">${estado.label}</span><br><br>
            <div class="popup-onibus-voto">
              <button class="botao-votar-lotacao" onclick="recentralizarMapa(${lat}, ${lng}); abrirVotacao('${id}', ${lat}, ${lng})">Votar na Lotação</button>
            </div>
          </div>
        `;

        if (marcadores[id]) {
          // Atualiza posição e popup
          marcadores[id].setLatLng([lat, lng]);
          marcadores[id].getPopup().setContent(popup);
        } else {
          const marcador = L.marker([lat, lng], { icon: iconeOnibus(rota.cor) });
          marcador.bindPopup(popup).addTo(map);
          marcador.on('click', () => {
            marcadorSelecionadoId = id;
            map.setView(marcador.getLatLng(), 15, { animate: true });
            marcador.openPopup();
            if (rota.coords && rota.coords.length > 0) {
              desenharRota(rota.coords, rota.cor);
            }
          });
          marcadores[id] = marcador;
        }
      });
    }

    atualizarBusao();
    setInterval(atualizarBusao, 5000);

    function recentralizarMapa(lat, lng) {
      if (typeof map !== "undefined") {
        map.setView([lat, lng], 18, { animate: true });
      }
    }

    // ------------------ PARADAS ------------------
    async function carregarParadasNoMapa() {
      try {
        const res = await fetch("/static/data/paradas.json");
        const paradas = await res.json();

        paradas.forEach(parada => {
          const { nome, localizacao, lat, lng } = parada;
          if (!lat || !lng) return;

          const marcadorParada = L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: "/static/img/parada.png",
              iconSize: [32, 32],
              iconAnchor: [16, 32],
              popupAnchor: [0, -32]
            })
          });

          marcadorParada.bindPopup(`<strong>${nome}</strong><br>${localizacao}`);
          marcadorParada.addTo(map);
        });
      } catch (e) {
        console.error("Erro ao carregar paradas:", e);
      }
    }

    carregarParadasNoMapa();
  }

  // ------------------ FORMULÁRIO CADASTRAR PARADA ------------------
  window.abrirFormularioParada = function(lat, lng) {
    const nome = prompt("Digite um nome para esta parada:");
    if (!nome) return;

    fetch("/api/cadastrar_parada", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: nome,
        localizacao: "Criada pelo usuário no local atual",
        lat: lat,
        lng: lng
      })
    }).then(res => res.json())
      .then(json => {
        alert(json.status || json.erro);
        location.reload(); // Atualiza o mapa com a nova parada
      });
  }

  // ------------------ MOSTRAR FAVORITAS ------------------
  window.mostrarFavoritas = async function() {
    try {
      // Pega o email do usuário via template Jinja
      const email = document.body.dataset.email;

      if (!email) {
        alert("Você precisa estar logado para ver as paradas favoritas.");
        return;
      }

      // Busca dados dos usuários para achar os favoritos
      const resUser  = await fetch("/data/usuarios.json");
      const usuarios = await resUser .json();

      const usuario = usuarios.find(u => u.email === email);
      if (!usuario || !usuario.favoritos || usuario.favoritos.length === 0) {
        alert("Nenhuma parada favorita encontrada.");
        return;
      }

      // Busca dados das paradas
      const resParadas = await fetch("/static/data/paradas.json");
      const paradas = await resParadas.json();

      // Filtra só as paradas favoritas do usuário
      const lista = paradas.filter(p => usuario.favoritos.includes(p.id));

      const listaTexto = lista.map(p => `• ${p.nome} (${p.localizacao})`).join("\n") || "Nenhuma parada favorita.";

      alert("Paradas Favoritas:\n\n" + listaTexto);

    } catch (e) {
      alert("Erro ao buscar paradas favoritas.");
      console.error(e);
    }
  }

  // ------------------ LOGIN ------------------
  const formLogin = document.getElementById("formLogin");
  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value.trim();
      const senha = document.getElementById("senha").value;

      const resposta = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha })
      });

      const dados = await resposta.json();

      if (dados.status === "sucesso") {
        abrirPopupLoginSucesso();
      } else {
        alert(dados.mensagem || "Erro no login");
      }
    });
  }

  // ------------------ CADASTRO ------------------
  function abrirPopupCadastroSucesso(nomeUsuario) {
  const fundo = document.getElementById('popup-fundo-cadastro');
  const popup = document.getElementById('popup-sucesso-cadastro');
  const nomeSpan = document.getElementById('nome-usuario-popup');

  nomeSpan.textContent = nomeUsuario;

  fundo.style.display = 'flex';

  popup.style.animation = 'none';
  popup.offsetHeight;
  popup.style.animation = null;
  }

  const formCadastro = document.getElementById("formCadastro");
  if (formCadastro) {
    formCadastro.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nome = document.getElementById("reg-nome").value.trim();
      const telefone = document.getElementById("reg-tel").value.trim();
      const email = document.getElementById("reg-email").value.trim();
      const senha = document.getElementById("reg-senha").value;

      if (!nome || !telefone || !email || !senha) {
        alert("Preencha todos os campos!");
        return;
      }

      const resposta = await fetch("/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, telefone, email, senha })
      });

      const dados = await resposta.json();

      if (dados.status === "sucesso") {
        const loginRes = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, senha })
        });

        const loginDados = await loginRes.json();

        if (loginDados.status === "sucesso") {
          abrirPopupCadastroSucesso(nome);
        } else {
          alert("Cadastro realizado, mas falha no login automático. Faça login manualmente.");
          window.location.href = "/login";
        }
      } else {
        alert(dados.mensagem || "Erro ao cadastrar");
      }
    });
  }

  // ------------------ MÁSCARA DE TELEFONE ------------------
  if (window.jQuery && $('#reg-tel').length) {
    $('#reg-tel').mask('(00) 00000-0000');
  }
});

function decodeUtf8(str) {
  try {
    return decodeURIComponent(escape(str));
  } catch {
    return str; // se der erro, retorna original
  }
}

// ------------------ MENU HAMBURGER ------------------
const navToggle = document.getElementById("nav-toggle");
const navMenu = document.getElementById("nav-menu");
const iconMenu = document.querySelector(".nav-burguer");
const iconClose = document.querySelector(".nav-close");

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    const menuAberto = navMenu.classList.toggle("menu-aberto");

    if (menuAberto) {
      iconMenu.style.opacity = 0;
      iconClose.style.opacity = 1;
    } else {
      iconMenu.style.opacity = 1;
      iconClose.style.opacity = 0;
    }
  });
}

// ---- POPUP DE VOTO CONFIRMADO -----
function abrirPopupConfirmacao() {
  const fundo = document.getElementById('popup-fundo');
  const popup = document.getElementById('popup-confirmacao');

  fundo.style.display = 'flex';

  popup.style.animation = 'none';
  popup.offsetHeight;
  popup.style.animation = null;
}

function fecharPopupConfirmacao() {
  const fundo = document.getElementById('popup-fundo');
  fundo.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  const btnFechar = document.getElementById('popup-fechar');
  btnFechar.addEventListener('click', fecharPopupConfirmacao);
});

// ---- POPUP DE LOGIN -----
function abrirPopupLoginSucesso() {
  const fundo = document.getElementById('popup-fundo-login');
  const popup = document.getElementById('popup-sucesso-login');

  fundo.style.display = 'flex';

  popup.style.animation = 'none';
  popup.offsetHeight;
  popup.style.animation = null;
}

function irParaMapa() {
  window.location.href = "/";
}
