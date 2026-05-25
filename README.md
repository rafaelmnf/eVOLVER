## Projeto Desenvolvido pelos alunos da PUC Campinas: 
- Lucas Espica Rezende 
- Rafael Martiniano Nogueira Filho
- Renato Hildebrand Pissinatti

Link da estruturação do projeto: https://www.figma.com/board/e9ZoAOv3ZKa40s7hnpTEbT/eVOLVER?node-id=19-725&t=7BpRwDXWFm8qj7tB-0

## Como rodar o projeto:
Este projeto foi configurado utilizando o pnpm como gerenciador de pacotes devido à velocidade e eficiência em monorepos/estruturas híbridas.

1. Certifique-se de ter o Node.js instalado.
2. Caso ainda não tenha o pnpm instalado globalmente, instale-o rodando o comando abaixo no seu terminal:
`npm install -g pnpm`

3. Navegue até a pasta raiz do projeto (eVOLVER) no seu terminal e execute:
`pnpm install`
4. Rode no terminal:
`pnpm run dev`

## eVOLVER — Design Brainstorm

### Ideia Principal
Plataforma científica de monitoramento de biorreatores. Público: pesquisadores, biólogos, engenheiros.
Tema obrigatório: dark científico, verde/preto, sensação de terminal de laboratório ativo.

Tema do Projeto — "Bioluminescence"

**Design Movement:** Dark Scientific Editorial — terminal de missão espacial com vida orgânica

**Core Principles:**
- Dados vivos: a interface reflete que os biorreatores são organismos ativos
- Hierarquia luminosa: elementos mais importantes têm mais brilho (glow)
- Layout sidebar + conteúdo principal com grid fluido de cards
- Precisão técnica sem frieza — bordas finas, espaçamento generoso

**Color Philosophy:**
- Fundo #0a0f0a como substrato de laboratório — preto com leve matiz verde
- Verde #1db954 como bioluminescência — os organismos emitem luz
- Glow verde rgba(29,185,84,0.15) como halo ao redor de elementos vivos
- Texto #e8f5e8 levemente esverdeado — até o texto respira o ambiente

**Layout Paradigm:**
- Sidebar fixa esquerda (260px) com logo, nav e status do sistema
- Área principal com padding generoso, grid responsivo de cards
- Painel de alertas como drawer lateral direito
- Breadcrumb + header por página com status do experimento ativo

**Signature Elements:**
- Dot-grid no fundo: pontos verdes em rgba(29,185,84,0.04) a cada 24px
- Cards com glow verde suave ao hover: box-shadow 0 0 20px rgba(29,185,84,0.15)
- Pulse animation em sensores ativos — como batimento cardíaco

**Interaction Philosophy:**
- Hover ilumina — elementos ganham brilho ao receber foco
- Dados em tempo real com counter animation suave
- Alertas urgentes pulsam para chamar atenção sem interromper fluxo

**Animation:**
- @keyframes pulse-green: scale 1→1.02, opacity 0.8→1, 2s ease-in-out infinite
- Fade-in stagger nos cards: translateY(8px)→0, opacity 0→1, 50ms delay
- Gráficos com stroke-dashoffset animation ao carregar
- Novos alertas: slide-in-right 300ms ease-out

**Typography System:**
- Display: Space Grotesk 600/700 — títulos, nomes de dispositivo, seções
- Data: IBM Plex Mono 400/500 — todos os valores numéricos, timestamps, IDs
- Body: DM Sans 400/500 — labels, descrições, textos de suporte
- Métricas: 3rem+, IBM Plex Mono, cor verde primária