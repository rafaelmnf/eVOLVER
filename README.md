# eVOLVER — Monitoramento de Biorreatores

Projeto desenvolvido pelos alunos da PUC Campinas:
- Lucas Espica Rezende
- Rafael Martiniano Nogueira Filho
- Renato Hildebrand Pissinatti

🔗 [Link da estruturação do projeto no Figma](https://www.figma.com/board/e9ZoAOv3ZKa40s7hnpTEbT/eVOLVER?node-id=19-725&t=7BpRwDXWFm8qj7tB-0)

---

## 🛠️ Arquitetura do Projeto

O projeto é estruturado como um monorepo contendo os seguintes componentes:

*   **`frontend/`:** Painel de controle desenvolvido em **React + Vite**, com gráficos em tempo real utilizando **Recharts**, ícones com **Lucide React** e estilo visual escuro personalizado.
*   **`backend/`:** Servidor **Node.js (Express + TypeScript)** que atua como ponte de dados. Contém:
    *   Cliente **MQTT** para receber telemetria enviada pelas Raspberry Pi Pico 2.
    *   Servidor **WebSocket** para distribuir dados em tempo real para os navegadores dos clientes conectados.
*   **`shared/`:** Constantes e configurações compartilhadas entre frontend e backend.

### 📊 Banco de Dados (Arquitetura Híbrida)
*   **PostgreSQL (Relacional):** Responsável pelo controle de metadados como usuários (pesquisadores), experimentos, nós masters, nós slaves, alertas e configurações/limites de sensores.
*   **InfluxDB (Séries Temporais):** Responsável por armazenar de forma otimizada o fluxo de alta frequência de dados dos sensores (temperatura, densidade ótica e rotação/agitação).

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
Certifique-se de ter instalado em sua máquina:
1.  [Node.js](https://nodejs.org/) (Versão LTS recomendada)
2.  [pnpm](https://pnpm.io/) (Gerenciador de pacotes) - `npm install -g pnpm`
3.  [Docker Desktop](https://www.docker.com/products/docker-desktop/) rodando na máquina.

---

### Passo 1: Subir os Bancos de Dados (Docker)
Na pasta raiz do projeto, execute o comando abaixo para baixar e iniciar os contêineres do PostgreSQL e InfluxDB em segundo plano:
```bash
docker compose up -d
```
*   O PostgreSQL estará acessível localmente na porta **`5433`** (mapeada para evitar conflitos com instalações locais).
*   O InfluxDB estará acessível localmente na porta **`8086`** (possui painel visual em http://localhost:8086/).

---

### Passo 2: Instalar Dependências
Na raiz do projeto, instale as dependências de todos os pacotes executando:
```bash
pnpm install
```

---

### Passo 3: Executar a Aplicação (Desenvolvimento)
Execute o comando abaixo para iniciar simultaneamente o frontend e o backend em modo de desenvolvimento:
```bash
pnpm run dev
```
*   **Frontend (Vite):** http://localhost:5173/
*   **Backend (API + WebSocket + MQTT):** http://localhost:3000/


## 🎨 Design Brainstorm — "Bioluminescence"

### Princípios de Estilo
*   **Dados vivos:** A interface reflete que os biorreatores são organismos ativos e dinâmicos.
*   **Hierarquia luminosa:** Elementos críticos ou ativos possuem brilho (*glow*) e animações suaves (*pulse*).
*   **Layout:** Sidebar fixa à esquerda (navegação), área principal fluida com grids de sensores, e gaveta de alertas à direita.

### Cores Principais
*   **Fundo (#0a0f0a):** Preto profundo com leve matiz verde, simulando um substrato de laboratório.
*   **Verde Primário (#1db954):** Brilho bioluminescente representando organismos ativos.
*   **Glow verde:** Sombras e halos suaves (`rgba(29, 185, 84, 0.15)`).

### Tipografia
*   **Títulos/Seções:** *Space Grotesk* (Peso 600/700) - visual moderno e futurista.
*   **Valores Numéricos/IDs/Timestamps:** *IBM Plex Mono* (Peso 400/500) - terminal técnico preciso.
*   **Textos/Descrições:** *DM Sans* (Peso 400/500) - leitura confortável.