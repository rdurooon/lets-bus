document.addEventListener("DOMContentLoaded", () => {
  // ------------------ MAPA ------------------
  const mapElement = document.getElementById("map");

  if (mapElement) {
    const map = L.map("map");
    const marcadores = {};
    let marcadorUser  = null;

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
      const html = `<div class="icone-onibus" style="border-color: ${cor}"><img src="/static/img/bus.jpg" /></div>`;
      return L.divIcon({ html, className: "", iconSize: [50, 50], iconAnchor: [24, 25] });
    }

    function mostrarLocalizacaoUser (lat, lng) {
      const html = `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="background-color: #8a2be2; color: white; padding: 2px 6px; border-radius: 12px; font-size: 11px; font-weight: bold; margin-bottom: 2px;">VOCÊ</div>
          <div style="width: 14px; height: 14px; border-radius: 50%; background-color: #8a2be2;"></div>
        </div>
      `;

      if (marcadorUser ) {
        marcadorUser .setLatLng([lat, lng]);
      } else {
        marcadorUser  = L.marker([lat, lng], {
          icon: L.divIcon({ className: '', html: html, iconSize: [30, 30], iconAnchor: [15, 15] })
        }).addTo(map);

        // Clique no marcador VOCÊ abre opções
        marcadorUser .on('click', () => {
          const popup = `
            <div style="text-align: center;">
              <h4>Você está aqui</h4>
              <button onclick="abrirFormularioParada(${lat}, ${lng})">Cadastrar Parada</button><br><br>
              <button onclick="mostrarFavoritas()">Ver Favoritas</button>
            </div>
          `;
          L.popup().setLatLng([lat, lng]).setContent(popup).openOn(map);
        });
      }
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          mostrarLocalizacaoUser (latitude, longitude);
        },
        err => {
          console.warn("Erro ao obter localização do usuário: ", err.message);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }

    async function atualizarBusao() {
      const res = await fetch("/api/onibus");
      const dados = await res.json();

      if (!map._loaded) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            const { latitude, longitude } = pos.coords;
            map.setView([latitude, longitude], 15);
            mostrarLocalizacaoUser (latitude, longitude);
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
            <button class="popup-onibus" onclick="recentralizarMapa(${lat}, ${lng}); abrirVotacao('${id}', ${lat}, ${lng})">Votar na Lotação</button>
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

    window.abrirVotacao = function (id, lat, lng) {
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

    window.recentralizarMapa = function(lat, lng) {
      map.setView([lat, lng], 15); // Recentraliza o mapa no ônibus
    }

    window.enviarVoto = async function (id, voto) {
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
      const email = "{{ usuario.email }}";

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
        alert("Login realizado com sucesso!");
        window.location.href = "/";
      } else {
        alert(dados.mensagem || "Erro no login");
      }
    });
  }

  // ------------------ CADASTRO ------------------
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
        alert("Cadastro realizado!");
        window.location.href = "/login";
      } else {
        alert(dados.mensagem || "Erro ao cadastrar");
      }
    });
  }

  // ------------------ MÁSCARA DE TELEFONE ------------------
  if (window.jQuery && $('#reg-tel').length) {
    $('#reg-tel').mask('(00) 0000-0000');
  }
});
