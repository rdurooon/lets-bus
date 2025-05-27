# 🚌 Localizador de Ônibus em Tempo Real

Este projeto tem como objetivo o desenvolvimento de um sistema de rastreamento de ônibus em tempo real utilizando Arduino, com uso do módulos GPS e GSM, também contanto com uma aplicação web.

## 📦 Sobre o Software

A base do software consiste em duas partes principais:

- **Dispositivo Embarcado (Arduino)**  
  Código responsável por coletar a localização do ônibus (via GPS) e enviá-la periodicamente para uma API web utilizando o módulo GSM.

- **Servidor Backend (API)**  
  Uma aplicação Flask (Python) que recebe os dados enviados pelos dispositivos e os armazena/organiza. Também serve os dados para o frontend.

- **Interface Web**  
  Um mapa interativo que exibe em tempo real a localização de todos os ônibus ativos, incluindo informações como o estado de lotação (com base em votos dos usuários).

## 🔧 Tecnologias Utilizadas

- Arduino C/C++
- Módulo GPS e GSM
- Python 3 + Flask
- HTML/CSS + JavaScript (Leaflet.js)

## 🚧 Em Desenvolvimento

Este projeto está em construção. Funcionalidades como envio automático de localização, visualização em tempo real e votação de lotação estão em fase de testes e melhorias.

---