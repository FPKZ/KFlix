# KFlix TV 📺🎬

> **Jellyfin TV Shell ultra-leve de alta performance para Fire TV Stick, Smart TVs Samsung (Tizen) e dispositivos Android.**

O **KFlix** é um cliente leve e otimizado para o media server **Jellyfin**, projetado especificamente para a experiência de sala de estar (*10-foot UI*). Ele combina um motor compartilhado de navegação espacial D-Pad injetado em tempo de execução com cascas nativas ultra-rápidas para Android (Kotlin + WebView acelerado por hardware) e Samsung Tizen (W3C Web App).

---

## ⚡ Por que KFlix?

- 🪶 **Ultra-leve:** APK final com menos de **3 MB** (sem sobrecarga de React Native, Flutter ou Chromium embutido).
- 🎮 **Controle Remoto Intuitivo:** Navegação espacial bidimensional suave (D-Pad), foco nítido de alto contraste e tratamento nativo de teclas de mídia (Play/Pause, Seek de 10s).
- 🔄 **URL Flexível e Dinâmica:** Troque ou configure a URL do seu servidor Jellyfin a qualquer momento através do menu na tela, com validação automática e persistência incondicional.
- 📱 **Compatibilidade Universal:** Funciona perfeitamente em **Fire TV Stick**, **Android TV**, **TVs Samsung (Tizen)**, e também em **smartphones e tablets Android**.
- 🚀 **Aceleração por Hardware:** Decodificação de vídeo direta via GPU com suporte completo a tela cheia e transições sem engasgos.

---

## 🎮 Guia de Navegação pelo Controle Remoto

O KFlix foi desenhado para ser controlado 100% pelo controle remoto de TV:

| Botão / Tecla | Ação na Interface | Ação durante Reprodução de Vídeo |
| :--- | :--- | :--- |
| **D-Pad (Cima / Baixo / Esquerda / Direita)** | Pula atomicamente de banner em banner com rolagem centralizada suave | Esquerda/Direita avança ou retrocede 10 segundos |
| **Borda Esquerda (Seta Esquerda no 1º card)** | Abre e foca o menu lateral (Drawer) do Jellyfin | - |
| **D-Pad Center (OK / Select / Enter)** | Abre o item selecionado ou confirma ação | Pausa / Retoma reprodução se controles visíveis |
| **Play / Pause (⏯)** | Inicia a reprodução do item selecionado | Alterna instantaneamente entre Play e Pause |
| **Avanço Rápido (⏩) / Retrocesso (⏪)** | - | Avança ou retrocede 10 segundos no vídeo |
| **Voltar (Return / Back / Escape)** | Retorna à tela/menu anterior do Jellyfin | **Fecha o player** e retorna à tela de detalhes do filme/série |
| **Duplo Clique no Menu (ou F10)** | **Alterna entre Modo TV D-Pad e Modo Mouse Virtual (Cursor TV)** | - |
| **Menu (≡) (1 clique) ou Segurar Voltar** | **Abre o Diálogo de Configuração de Servidor** | **Abre o Diálogo de Configuração de Servidor** |

> 💡 **Nota sobre o Modo Mouse Virtual (TV Pointer):** Pressione duas vezes a tecla Menu rapidamente (ou tecla F10 no teclado) para ativar um cursor suave na tela. O D-Pad move o cursor com aceleração dinâmica, o botão OK clica onde o cursor apontar, e aproximar o cursor do topo ou do rodapé rola a página suavemente para cima ou para baixo! Pressione duas vezes o Menu novamente para retornar ao D-Pad.

> 💡 **Nota sobre o botão Voltar:** O KFlix possui proteção inteligente contra saídas acidentais (*anti-back trap*). Se um vídeo estiver em reprodução ou em tela cheia, pressionar Voltar fecha o player e preserva sua navegação. Pressionar Voltar na tela inicial exibe um diálogo de confirmação antes de sair do aplicativo.

---

## ⚙️ Como Alterar a URL do Servidor Jellyfin

Você pode alterar o endereço do servidor a qualquer momento, sem precisar reinstalar ou limpar os dados do app:

1. No controle remoto, pressione o botão **Menu (≡)** ou **mantenha pressionado o botão Voltar** por 1 segundo.
2. A janela **"Configurar Servidor Jellyfin"** será exibida sobre a interface.
3. Digite o endereço IP local ou domínio do seu servidor (ex: `http://192.168.1.100:8096` ou `https://meujellyfin.com`).
   * *O app adiciona automaticamente `http://` se você esquecer e remove barras extras no final.*
4. Selecione **"Salvar e Conectar"**.
5. O aplicativo testará a conectividade com o servidor em segundo plano e recarregará a interface imediatamente.

---

## 📦 Estrutura do Projeto

```text
KFlix/
├── shared/
│   └── engine/                   # Motor compartilhado (Web/Engine)
│       ├── kflix-spatnav.js       # Algoritmo de navegação espacial D-Pad
│       ├── kflix-player.js        # Mapeamento de mídia e playback 10-foot
│       ├── kflix-tv-theme.css     # Estilos de foco de alto contraste
│       └── __tests__/             # Testes automatizados do motor
├── android/                      # Casca nativa Android / Fire TV (Kotlin)
│   ├── app/src/main/
│   │   ├── java/com/kflix/tv/    # MainActivity, ServerConfigManager, KeyEventHandler
│   │   ├── res/                  # Layouts, cores, temas de TV e banner Leanback
│   │   └── assets/               # Assets injetados em tempo de execução
│   └── app/src/test/             # Testes unitários JUnit
├── tizen/                        # Casca W3C Web App para Smart TVs Samsung
│   ├── config.xml                # Manifesto Tizen TV (1080p, privilégios)
│   ├── index.html                # Shell de inicialização e iframe/host
│   ├── js/tizen-main.js          # Integração com Tizen TV Input Device API
│   └── css/tizen-style.css       # Estilos da casca Tizen
├── scripts/                      # Scripts de compilação e empacotamento
│   ├── build-apk.sh              # Gera o APK Android (dist/kflix-tv-debug.apk)
│   └── package-tizen.sh          # Empacota o widget Tizen (dist/kflix-tizen.wgt)
└── dist/                         # Artefatos prontos para distribuição
    ├── kflix-tv-debug.apk        # APK para Fire TV e Android
    └── kflix-tizen.wgt           # Pacote W3C para Samsung TV
```

---

## 🚀 Guia de Instalação no Fire TV Stick

### Método 1: Instalação via ADB (Mais Rápido para Desenvolvedores)

1. No seu Fire TV Stick, vá em **Configurações (Settings) > Meu Fire TV > Informações**.
2. Clique 7 vezes sobre o nome do seu Fire TV para habilitar as **Opções de Desenvolvedor**.
3. Em **Opções de Desenvolvedor**, ative a opção **Depuração ADB (ADB Debugging)**.
4. Anote o endereço IP do seu Fire TV (em *Configurações > Meu Fire TV > Informações > Rede*).
5. No seu computador conectado à mesma rede Wi-Fi, execute:
   ```bash
   # Conectar ao Fire TV
   adb connect 192.168.1.X:5555

   # Instalar o APK do KFlix
   adb install -r dist/kflix-tv-debug.apk
   ```
6. O KFlix aparecerá na sua lista de aplicativos instalados com o banner oficial de TV.

### Método 2: Instalação via App Downloader

1. Na loja de aplicativos da Amazon no Fire TV, pesquise e instale o app gratuito **Downloader**.
2. Abra o app **Downloader** e digite a URL direta de download do arquivo `kflix-tv-debug.apk` hospedado na sua rede ou servidor web.
3. O download será iniciado e o instalador do Android solicitará a confirmação de instalação.
4. Conceda a permissão e selecione **Instalar**.

---

## 📱 Guia de Instalação no Celular / Tablet Android

O KFlix possui compatibilidade híbrida declarada no manifesto (`android.hardware.touchscreen` não obrigatório e `android.software.leanback` não obrigatório), o que permite sua execução direta em smartphones e tablets para testes ou uso portátil:

1. Transfira o arquivo `dist/kflix-tv-debug.apk` para o seu aparelho (via cabo USB, Google Drive, WhatsApp ou servidor local).
2. No celular, abra o gerenciador de arquivos e toque no arquivo `.apk`.
3. Se solicitado, autorize a instalação de fontes desconhecidas para o aplicativo que abriu o arquivo.
4. Toque em **Instalar** e em seguida em **Abrir**.
5. Na primeira inicialização, informe o endereço do seu Jellyfin e navegue normalmente pelo toque na tela.

---

## 📺 Guia de Instalação na Smart TV Samsung (Tizen)

Para instalar o KFlix em televisores Samsung com sistema operacional Tizen:

1. **Habilitar Modo Desenvolvedor na TV:**
   - Abra o menu **Apps** na sua Samsung TV.
   - Pressione no controle remoto a sequência numérica: `1` `2` `3` `4` `5`.
   - A janela do **Developer Mode** será exibida. Mude o interruptor para **ON**.
   - No campo **Host PC IP**, digite o endereço IP do computador onde o Tizen Studio está instalado.
   - Reinicie a TV (mantenha o botão Power do controle pressionado até a logo Samsung reaparecer).
2. **Conectar e Instalar via Terminal / SDB:**
   ```bash
   # Conectar à TV Samsung na mesma rede
   sdb connect 192.168.1.Y:26101

   # Listar dispositivos conectados
   sdb devices

   # Instalar o pacote .wgt do KFlix
   tizen install -n dist/kflix-tizen.wgt -t <DEVICE_ID>
   ```
3. O ícone do **KFlix** ficará visível na barra de aplicativos da Smart Hub da Samsung.

---

## 🛠️ Comandos de Desenvolvimento e Testes

### Executar Testes Automatizados

```bash
# Executar todos os testes do motor compartilhado e Tizen (Jest / Node.js)
npm test

# Executar testes unitários do Android (JUnit / MockK)
cd android && ./gradlew testDebugUnitTest
```

### Compilar e Gerar Pacotes de Distribuição

```bash
# Gerar APK Android limpo e otimizado (dist/kflix-tv-debug.apk)
./scripts/build-apk.sh

# Gerar pacote W3C Samsung Tizen (dist/kflix-tizen.wgt)
./scripts/package-tizen.sh
```

---

## 📋 Licença e Créditos

Desenvolvido para a comunidade Jellyfin e entusiastas de streaming doméstico de alto desempenho.
Distribuído sob a licença **MIT**.
