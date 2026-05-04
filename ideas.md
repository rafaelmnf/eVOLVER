# eVOLVER — Design Brainstorm

## Contexto
Plataforma científica de monitoramento de biorreatores. Público: pesquisadores, biólogos, engenheiros.
Tema obrigatório: dark científico, verde/preto, sensação de terminal de laboratório ativo.

---

<response>
<text>

## Abordagem 1 — "Mission Control" (p=0.07)

**Design Movement:** Aerospace HUD / Scientific Terminal dos anos 90 modernizado

**Core Principles:**
- Densidade de informação máxima sem ruído visual — cada pixel justificado
- Hierarquia de dados por luminosidade: valores críticos brilham, contexto recua
- Assimetria intencional: sidebar fixa à esquerda com 240px, conteúdo principal ocupa resto
- Bordas finas como circuitos impressos — 1px, nunca arredondadas além de 4px

**Color Philosophy:**
- Fundo #0a0f0a como câmara escura de laboratório
- Verde #1db954 como sinal de vida — bioreatores ativos pulsam
- Amarelo âmbar #d4a017 para alertas — como LEDs de aviso
- Vermelho #c0392b escasso, apenas para falhas críticas

**Layout Paradigm:**
- Sidebar vertical esquerda fixa (240px) com navegação e status geral
- Área principal dividida em grid assimétrico: 2/3 para gráficos, 1/3 para métricas
- Painel de alertas deslizante pela direita (drawer), não modal
- Sem hero section — interface começa direto nos dados

**Signature Elements:**
- Dot-grid sutil no fundo (grade de pontos verdes muito escuros)
- Linhas de scan horizontal animadas nos cards ativos (scanline effect)
- Números de sensor em IBM Plex Mono com glow verde suave

**Interaction Philosophy:**
- Hover revela contexto adicional sem mudar layout
- Click expande inline, não abre modal separado
- Dados em tempo real com transição de valor suave (counter animation)

**Animation:**
- Pulse verde em sensores ativos: 2s ease-in-out infinite
- Fade-in stagger nos cards: 50ms delay entre cada
- Gráficos desenham da esquerda para direita ao carregar
- Novos alertas entram com slide-in da direita

**Typography System:**
- Display: Space Grotesk 700 — títulos de seção, nomes de dispositivo
- Data: IBM Plex Mono — todos os valores numéricos, timestamps
- Body: DM Sans 400/500 — labels, descrições, textos de suporte

</text>
<probability>0.07</probability>
</response>

---

<response>
<text>

## Abordagem 2 — "Oscilloscope" (p=0.06)

**Design Movement:** Instrumentação científica analógica digitalizada — osciloscópio moderno

**Core Principles:**
- Tudo é waveform — até elementos de UI sugerem ondas e sinais
- Contraste extremo: preto profundo vs verde fosforescente
- Layout em painéis independentes como instrumentos modulares (rack de laboratório)
- Tipografia monospace dominante — interface parece terminal científico

**Color Philosophy:**
- Background #050a05 — mais escuro que o especificado, quase negro absoluto
- Verde #00ff41 fosforescente (Matrix green) para dados ao vivo
- Verde #1db954 para elementos de UI estáticos
- Sem gradientes suaves — transições abruptas como sinais digitais

**Layout Paradigm:**
- Grid de painéis independentes, cada um com borda e título próprio
- Painéis podem ser "minimizados" como instrumentos desligados
- Topologia de dispositivos como diagrama de circuito
- Navegação horizontal superior minimalista (apenas ícones + tooltip)

**Signature Elements:**
- Efeito CRT sutil: leve curvatura nas bordas dos cards, scanlines
- Números com efeito de "digit flip" ao atualizar
- Cursor piscante em campos de input (blinking cursor)

**Interaction Philosophy:**
- Interface responde como terminal — feedback imediato, sem animações longas
- Confirmações inline com texto, não modais visuais
- Keyboard-first: atalhos visíveis, tab navigation clara

**Animation:**
- Digit flip nos valores: 150ms, cubic-bezier rápido
- CRT flicker suave: opacity 0.98→1 em loop muito lento
- Gráficos com linha que "escreve" continuamente da esquerda

**Typography System:**
- Tudo: JetBrains Mono — consistência total de terminal
- Hierarquia por tamanho e cor, não por família tipográfica
- Labels em uppercase com letter-spacing 0.15em

</text>
<probability>0.06</probability>
</response>

---

<response>
<text>

## Abordagem 3 — "Bioluminescence" (p=0.08) ← SELECIONADA

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

</text>
<probability>0.08</probability>
</response>
