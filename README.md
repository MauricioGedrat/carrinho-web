# Controle do carrinho (site)

Site em **Next.js + TypeScript + Tailwind** que controla o carrinho Bluetooth do ESP32 direto pelo navegador, sem instalar aplicativo.

Autores: Maurício Gedrat e Matheus Bizarro — Técnico em Eletrônica.

## Como funciona

```
Celular / PC (Chrome ou Edge)  --BLE-->  ESP32 (carrinho_web.ino)  -->  L298N + LEDs
        site Next.js                      serviço "Nordic UART"
```

- O site usa a **Web Bluetooth API**, que só fala **BLE** (Bluetooth Low Energy).
- O firmware `carrinho_web.ino` liga **os dois Bluetooth ao mesmo tempo**:
  - **BLE** para este site;
  - **Bluetooth clássico** para os apps antigos (App Inventor e "Arduino Bluetooth RC Car").
- O site manda uma letra por comando e o ESP32 responde o estado em 4 letras (ex.: `F2C1` = frente, velocidade 2, direção no centro, farol ligado). O desenho do carrinho na tela acende as mesmas luzes do carrinho de verdade.

| Letra | O que faz |
|---|---|
| `F` / `B` / `S` | frente / ré / parar (freio) |
| `L` / `R` / `C` | esquerda / direita / centro |
| `1` / `2` / `3` | velocidade lenta / média / máxima |
| `H` / `h` | liga / desliga o farol |
| `?` | pede o estado atual |

## Onde funciona

| Aparelho | Navegador | Funciona? |
|---|---|---|
| Android | Chrome, Edge, Samsung Internet | Sim |
| Windows / Linux / Mac | Chrome, Edge | Sim |
| iPhone / iPad | qualquer um | **Não** (a Apple não libera Web Bluetooth) |
| Qualquer | Firefox | **Não** |

O site precisa estar em **HTTPS** (ou em `localhost`) para o navegador liberar o Bluetooth.

## Passo a passo

### 1. Gravar o firmware no ESP32

1. Abra `firmware/carrinho_web/carrinho_web.ino` no Arduino IDE.
2. **Ferramentas → Partition Scheme → "Huge APP (3MB No OTA/1MB SPIFFS)"** (obrigatório, o BLE + Bluetooth clássico ocupam muita memória).
3. Placa "DOIT ESP32 DEVKIT V1", porta COM certa, e Upload.
4. Em outro carrinho, troque a linha `NOME_BT` (ex.: `"Carrinho_Leonardo"`). O site encontra qualquer nome que comece com "Carrinho".

### 2. Rodar o site no computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install
npm run dev
```

Abra **http://localhost:3000** no Chrome do computador (o PC precisa ter Bluetooth), clique em **Conectar ao carrinho** e escolha `Carrinho_Mauricio`.

### 3. Colocar na internet (para abrir no celular)

O jeito mais fácil e gratuito é a **Vercel**:

1. Entre em https://vercel.com com a conta do GitHub → **Add New → Project** → escolha o repositório → **Deploy**.
3. A Vercel dá um endereço `https://...vercel.app`. É só abrir no Chrome do celular Android.

## Controles

- **Segure** o botão para andar e **solte** para parar (igual ao app antigo).
- Velocidade 1, 2 e 3 e botão do farol no meio.
- No computador: setas ou **W A S D**, teclas **1 2 3** para a velocidade e **H** para o farol.
- Segurança: se a aba perder o foco, o site manda parar; se o Bluetooth cair, o próprio ESP32 para os motores.

## Arquivos

```
app/layout.tsx          página base (idioma, título, fonte)
app/page.tsx            página inicial
app/globals.css         cores do carrinho (Tailwind) e animação do pisca
lib/carrinho-ble.ts     conexão Web Bluetooth (UUIDs, enviar comando, ler estado)
hooks/use-carrinho.ts   hook React com o estado da conexão
components/controle.tsx tela do controle (botões e teclado)
components/carro.tsx    desenho do carrinho visto de cima
components/botao-segurar.tsx  botão de "segurar" (toque, mouse e teclado)
app/fontes/             fonte Barlow Semi Condensed (licença OFL)
firmware/carrinho_web/  firmware do ESP32 (BLE + Bluetooth clássico)
```
