document.addEventListener('DOMContentLoaded', () => {
  // ----- MENU LATERAL EXPANSÍVEL -----
  document.querySelectorAll(".section-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const submenu = document.getElementById(targetId);
      submenu.classList.toggle("active");
      btn.classList.toggle("open");

      const seta = btn.querySelector('.seta');
      if (seta) {
        seta.textContent = submenu.classList.contains("active") ? "▾" : "▸";
      }
    });
  });

  // ----- NAVEGAÇÃO ENTRE SEÇÕES -----
  window.abrirSecao = function(secao) {
    const conteudo = document.getElementById('conteudo-admin');
    conteudo.innerHTML = '';

    let titulo = document.createElement('h2');
    titulo.className = 'form-title';

    if (secao === "visual-onibus") {
      titulo.textContent = "Visualização de ônibus";
      conteudo.appendChild(titulo);

      fetch("/api/onibus")
        .then((res) => res.json())
        .then((onibus) => {
          onibus.forEach((bus) => {
            const panel = document.createElement("div");
            panel.className = "bus-panel";

            panel.innerHTML = `
              <div class="bus-info">
                <h3>Ônibus ID: ${bus.id}</h3>
                <p>Rota: <span style="color:${bus.rota.cor}">${bus.rota.nome}</span></p>
                <label class="switch">
                  <input type="checkbox" data-busid="${bus.id}" />
                  <span class="slider round"></span>
                  <span class="switch-label">Mostrar no mapa</span>
                </label>
              </div>
              <div id="map-${bus.id}" class="bus-map"></div>
            `;

            conteudo.appendChild(panel);

            const map = L.map(`map-${bus.id}`).setView([bus.lat, bus.lng], 15);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
              attribution: "&copy; OpenStreetMap contributors",
            }).addTo(map);

            const icon = L.divIcon({
              className: "custom-bus-icon",
              html: `<div class="icone-onibus" style="border-color: ${bus.rota.cor}"><img src="/static/img/bus.jpg" /></div>`,
              iconSize: [50, 50],
              iconAnchor: [25, 25]
            });

            const marker = L.marker([bus.lat, bus.lng], { icon }).addTo(map);

            // Atualização automática
            setInterval(() => {
              fetch("/data/bus.json")
                .then((res) => res.json())
                .then((updated) => {
                  const atual = updated.find(b => b.id === bus.id);
                  if (atual) {
                    marker.setLatLng([atual.lat, atual.lng]);
                    map.setView([atual.lat, atual.lng]);
                  }
                });
            }, 15000); // Atualiza a cada 15 segundos
          });
        });
    }


    if (secao === "cadastrar-onibus") {
      titulo.textContent = 'Cadastrar Novo Ônibus';
      const formHTML = `
        <div class="form-container">
          <form class="onibus-form">
            <label for="id-bus">ID do Ônibus</label>
            <input type="text" id="id-bus" name="id-bus" placeholder="Ex: 1000" required>

            <label for="rota">Nome da Rota</label>
            <input type="text" id="rota" name="rota" placeholder="Ex: Fazendinha" required>

            <label for="color">Cor da rota</label>
            <input type="number" id="color" name="color" placeholder="Ex: Vermenlho ou #FFFFF" required>

            <button type="submit">Cadastrar</button>
          </form>
        </div>
      `;

      conteudo.appendChild(titulo);
      conteudo.insertAdjacentHTML('beforeend', formHTML);
    }

    if (secao === "upload-xls") {
      titulo.textContent = 'Upload de Arquivo XLS';
      const formHTML = `
        <div class="form-container">
          <form class="onibus-form" id="upload-xls-form">
            <label for="upload-xls-rota-id">ID do Ônibus</label>
            <input type="text" id="upload-xls-rota-id" placeholder="Ex: 1000" required>

            <label for="upload-area">Selecione o arquivo XLS/XLSX</label>
            <div class="upload-area" id="upload-area">
              <input type="file" id="file-input" accept=".xls,.xlsx" hidden>
              <p id="upload-text">Arraste seu arquivo XLS/XLSX aqui ou clique para selecionar</p>
            </div>
            <p id="file-name" style="margin: 0 auto; margin-top: 20px; margin-bottom: 20px">Nenhum arquivo selecionado</p>

            <button type="button" id="btn-enviar-xls">Enviar Arquivo</button>

            <div id="upload-feedback" style="margin-top:10px;"></div>
          </form>
        </div>
      `;

      conteudo.appendChild(titulo);
      conteudo.insertAdjacentHTML('beforeend', formHTML);
      inicializarUploadXLS();
    }

    if (secao === "ver-usuarios") {
      container.innerHTML = `<h2>Lista de usuários</h2><p>Carregando usuários...</p>`;
    }

        if (secao === "imei_id"){
      titulo.textContent = 'Atualizar ID de Ônibus pelo IMEI do Módulo GSM';
      conteudo.appendChild(titulo);

      const formHTML = `
        <div class="form-container">
          <form id="form-imei" class="onibus-form">
            <label for="bus_id">Selecione o ID do Ônibus</label>
            <select id="bus_id" name="bus_id" required>
              <option value="" disabled selected>-- Carregando ônibus... --</option>
            </select>

            <label for="imei">Digite o IMEI do Módulo GSM</label>
            <input
              type="text"
              id="imei"
              name="imei"
              placeholder="Ex: 865067029012345"
              required
              pattern="\\d{15}"
              title="Digite um IMEI válido de 15 dígitos"
            />

            <button type="submit">Salvar</button>
          </form>
        </div>

        <h3 style="margin-top: 40px;">📋 Dispositivos Cadastrados:</h3>

        <table id="tabela-imeis" class="admin-tabela" aria-label="Tabela de dispositivos cadastrados">
          <thead>
            <tr>
              <th>IMEI</th>
              <th>ID Ônibus</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>

        <p id="mensagem-resultado" style="margin-top:10px;"></p>

        <div id="popup-fundo" aria-modal="true" role="dialog" aria-labelledby="popup-text" tabindex="-1" style="display: none">
          <div id="popup-confirmacao">
            <p id="popup-text"></p>
            <button id="popup-confirmar">Confirmar</button>
            <button id="popup-cancelar">Cancelar</button>
          </div>
        </div>
      `;

      conteudo.insertAdjacentHTML('beforeend', formHTML);

      const selectBus = document.getElementById('bus_id');
      const form = document.getElementById('form-imei');
      const mensagem = document.getElementById('mensagem-resultado');
      const tabelaBody = document.querySelector('#tabela-imeis tbody');

      function mostrarPopupConfirmacao(mensagem) {
        return new Promise(resolve => {
          const fundo = document.getElementById('popup-fundo');
          const texto = document.getElementById('popup-text');
          const btnConfirmar = document.getElementById('popup-confirmar');
          const btnCancelar = document.getElementById('popup-cancelar');

          texto.textContent = mensagem;
          fundo.style.display = 'flex';
          btnConfirmar.focus();

          function fechar(resposta) {
            fundo.style.display = 'none';
            btnConfirmar.removeEventListener('click', onConfirmar);
            btnCancelar.removeEventListener('click', onCancelar);
            resolve(resposta);
          }

          function onConfirmar() {
            fechar(true);
          }
          function onCancelar() {
            fechar(false);
          }

          btnConfirmar.addEventListener('click', onConfirmar);
          btnCancelar.addEventListener('click', onCancelar);
        });
      }

      // Carrega os ônibus no select
      async function carregarOnibus() {
        try {
          const res = await fetch('/api/onibus');
          const onibus = await res.json();
          selectBus.innerHTML = '<option value="" disabled selected>-- Selecione o ônibus --</option>';

          onibus.forEach(bus => {
            const nomeRota = bus.rota?.nome || 'Sem rota';
            const opt = document.createElement('option');
            opt.value = bus.id;
            opt.textContent = `${bus.id} - ${nomeRota}`;
            selectBus.appendChild(opt);
          });
        } catch (e) {
          selectBus.innerHTML = '<option disabled>Erro ao carregar ônibus</option>';
        }
      }

      // Carrega IMEIs existentes
      async function carregarMapeamentos() {
        try {
          const res = await fetch('/api/imei_id');
          const data = await res.json();
          tabelaBody.innerHTML = '';

          Object.entries(data).forEach(([imei, id]) => {
            const row = document.createElement('tr');
            row.innerHTML = `
              <td>${imei}</td>
              <td>${id}</td>
              <td>
                <button class="admin-botao btn-remover" data-imei="${imei}" style="background-color: #d9534f;">
                  Remover
                </button>
              </td>
            `;
            tabelaBody.appendChild(row);
          });

          document.querySelectorAll('.btn-remover').forEach(btn => {
            btn.addEventListener('click', async () => {
              const imei = btn.dataset.imei;
              const confirmado = await mostrarPopupConfirmacao(`Remover o IMEI ${imei}?`);
              if (confirmado) {
                const res = await fetch('/api/remover_imei', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ imei })
                });
                const result = await res.json();

                if (res.ok) {
                  mensagem.textContent = 'Removido com sucesso!';
                  mensagem.style.color = 'green';
                  carregarMapeamentos();
                } else {
                  mensagem.textContent = result.error || 'Erro ao remover.';
                  mensagem.style.color = 'red';
                }
              }
            });
          });

        } catch (e) {
          tabelaBody.innerHTML = '<tr><td colspan="3">Erro ao carregar mapeamentos.</td></tr>';
        }
      }

      // Envia novo IMEI para salvar
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const imei = document.getElementById('imei').value.trim();
        const id = document.getElementById('bus_id').value;

        mensagem.textContent = 'Salvando...';
        mensagem.style.color = 'black';

        try {
          const res = await fetch('/api/salvar_imei', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imei, id })
          });

          const result = await res.json();

          if (res.ok) {
            mensagem.textContent = 'IMEI vinculado com sucesso!';
            mensagem.style.color = 'green';
            form.reset();
            carregarMapeamentos();
          } else {
            mensagem.textContent = result.error || 'Erro ao salvar.';
            mensagem.style.color = 'red';
          }
        } catch (err) {
          mensagem.textContent = 'Erro de conexão.';
          mensagem.style.color = 'red';
        }
      });

      // Inicialização
      carregarOnibus();
      carregarMapeamentos();
    }

    const menuLateral = document.getElementById('menu-lateral');
    if (window.innerWidth <= 768 && menuLateral.classList.contains('active')) {
      menuLateral.classList.remove('active');
    }
  };

  // ----- MODAL FEEDBACK -----
  const modalFeedback = document.getElementById('modal-feedback');
  const modalFeedbackText = document.getElementById('modal-feedback-text');
  const modalFeedbackClose = document.getElementById('modal-feedback-close');
  const modalLoading = document.getElementById('modal-loading');

  if (modalFeedbackClose) {
    modalFeedbackClose.onclick = () => {
      modalFeedback.style.display = 'none';
    };
  }

  window.onclick = function (event) {
    if (event.target === modalFeedback) {
      modalFeedback.style.display = 'none';
    }
  };

  // ----- FUNÇÃO DE UPLOAD XLS -----
  function inicializarUploadXLS() {
    const fileInput = document.getElementById('file-input');
    const fileNameDisplay = document.getElementById('file-name');
    const uploadArea = document.getElementById('upload-area');
    const feedbackDiv = document.getElementById('upload-feedback');
    const rotaInput = document.getElementById('upload-xls-rota-id');

    // Área clicável
    uploadArea.addEventListener("click", () => fileInput.click());

    // Seleção manual
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) {
        fileNameDisplay.textContent = "Selecionado: " + fileInput.files[0].name;
      }
    });

    // Drag and drop
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });

    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("dragover");
    });

    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");

      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".xls") || file.name.endsWith(".xlsx"))) {
        fileInput.files = e.dataTransfer.files;
        fileNameDisplay.textContent = "Selecionado: " + file.name;
      } else {
        fileNameDisplay.textContent = "Arquivo inválido! Use .xls ou .xlsx.";
      }
    });

    // Envio do arquivo
    document.getElementById('btn-enviar-xls').addEventListener('click', async () => {
      feedbackDiv.textContent = '';
      feedbackDiv.style.color = '';

      if (!fileInput.files.length) {
        feedbackDiv.style.color = 'red';
        feedbackDiv.textContent = "Por favor, selecione um arquivo XLS/XLSX.";
        return;
      }

      const rotaId = rotaInput.value.trim();
      if (!rotaId) {
        feedbackDiv.style.color = 'red';
        feedbackDiv.textContent = "Por favor, informe o ID do ônibus para atualizar a rota.";
        return;
      }

      modalLoading.style.display = 'flex';

      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('bus_id', rotaId);

      try {
        const res = await fetch('/api/upload_rota_xls', {
          method: 'POST',
          body: formData
        });

        const json = await res.json();

        if (json.success) {
          let msg = `Rota atualizada com sucesso para o ônibus ${rotaId}.\n`;
          msg += `Total de ruas processadas: ${json.total_ruas}\n`;
          msg += `Coordenadas encontradas: ${json.coordenadas_encontradas}\n`;

          if (json.ruas_sem_coordenada?.length) {
            msg += `\nNão foram encontradas coordenadas para:\n - ${json.ruas_sem_coordenada.join('\n - ')}`;
          }

          modalFeedbackText.textContent = msg;
          modalFeedback.style.display = 'flex';

          fileInput.value = '';
          rotaInput.value = '';
          fileNameDisplay.textContent = 'Nenhum arquivo selecionado';
          feedbackDiv.textContent = '';
        } else {
          feedbackDiv.style.color = 'red';
          feedbackDiv.textContent = 'Erro: ' + (json.error || 'Erro ao atualizar rota.');
        }
      } catch (err) {
        feedbackDiv.style.color = 'red';
        feedbackDiv.textContent = 'Erro ao enviar o arquivo: ' + err.message;
      } finally {
        modalLoading.style.display = 'none';
      }
    });
  }
});



