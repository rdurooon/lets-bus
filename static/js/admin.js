document.addEventListener('DOMContentLoaded', () => {
  const modalFeedback = document.getElementById('modal-feedback');
  const modalFeedbackText = document.getElementById('modal-feedback-text');
  const modalFeedbackClose = document.getElementById('modal-feedback-close');

  const fileInput = document.getElementById('upload-xls');
  const nomeArquivoSpan = document.getElementById('upload-nome-arquivo');

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      nomeArquivoSpan.textContent = fileInput.files[0].name;
    } else {
      nomeArquivoSpan.textContent = 'Nenhum arquivo selecionado';
    }
  });

  modalFeedbackClose.onclick = () => {
    modalFeedback.style.display = 'none';
  };

  // Fechar modal clicando fora do conteúdo
  window.onclick = function(event) {
    if (event.target === modalFeedback) {
      modalFeedback.style.display = 'none';
    }
  };

  window.enviarArquivoXLS = async function() {
    const fileInput = document.getElementById('upload-xls');
    const rotaId = document.getElementById('upload-xls-rota-id').value.trim();
    const feedbackDiv = document.getElementById('upload-feedback');
    const modalLoading = document.getElementById('modal-loading');

    feedbackDiv.textContent = '';
    feedbackDiv.style.color = '';

    if (!fileInput.files.length) {
      feedbackDiv.style.color = 'red';
      feedbackDiv.textContent = "Por favor, selecione um arquivo XLS/XLSX.";
      return;
    }

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

        if (json.ruas_sem_coordenada && json.ruas_sem_coordenada.length > 0) {
          msg += `Não foram encontradas coordenadas para as ruas:\n - ${json.ruas_sem_coordenada.join('\n - ')}`;
        }

        modalFeedbackText.textContent = msg;
        modalFeedback.style.display = 'flex';

        fileInput.value = '';
        document.getElementById('upload-xls-rota-id').value = '';

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
  };
  document.querySelector('#btn-enviar-xls').addEventListener('click', enviarArquivoXLS);
});


