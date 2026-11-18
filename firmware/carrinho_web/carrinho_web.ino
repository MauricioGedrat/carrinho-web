/*
  ==================================================================
  CARRINHO DE CONTROLE REMOTO VIA BLUETOOTH - ESP32
  >>> VERSAO "WEB": Bluetooth CLASSICO + BLE AO MESMO TEMPO <<<
  Autores: Mauricio Gedrat e Matheus Bizarro
  ==================================================================
  - BLE (Bluetooth Low Energy): usado pelo SITE em Next.js
    (Web Bluetooth, no Chrome/Edge do Android e do PC).
  - Bluetooth CLASSICO: continua funcionando com o app do
    MIT App Inventor (CarrinhoBT).
  Os dois recebem AS MESMAS LETRAS e controlam o carrinho igual.

  Placa: DOIT ESP32 DEVKIT V1
  IMPORTANTE: Tools -> Partition Scheme -> "Huge APP (3MB No OTA/1MB SPIFFS)"
              (classico + BLE juntos ocupam bastante memoria)

  Driver: modulo L298N (ponte H dupla)
     - Canal A (ENA, IN1, IN2): motor de TRACAO (traseiro)
     - Canal B (ENB, IN3, IN4): motor de DIRECAO (dianteiro)

  COMANDOS (1 caractere cada):
     F = frente         B = re            S = parar
     L = esquerda       R = direita       C = direcao ao centro
     1, 2, 3 = velocidade da frente
     H = liga farol     h = desliga farol

  SERVICO BLE (padrao "Nordic UART", usado por muitos apps):
     Servico : 6e400001-b5a3-f393-e0a9-e50e24dcca9e
     RX      : 6e400002-...  (o site ESCREVE as letras aqui)
     TX      : 6e400003-...  (o ESP32 AVISA o estado aqui - notify)
  Estado enviado no TX (4 letras): [movimento][velocidade][direcao][farol]
     ex.: "F2C1" = frente, velocidade 2, direcao no centro, farol ligado
  ==================================================================
*/

#include "BluetoothSerial.h"
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED)
#error "Bluetooth nao habilitado! Selecione a placa DOIT ESP32 DEVKIT V1."
#endif

BluetoothSerial SerialBT;
const char* NOME_BT = "Carrinho_Mauricio";   // no 2o carrinho: "Carrinho_Leonardo"

// UUIDs do servico BLE "Nordic UART"
#define UUID_SERVICO "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define UUID_RX      "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
#define UUID_TX      "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

// ======================= PINOS =======================
const int ENA = 25;   // PWM tracao
const int IN1 = 26;
const int IN2 = 27;
const int ENB = 14;   // PWM direcao
const int IN3 = 32;
const int IN4 = 33;

const int LED_FAROL     = 23;
const int LED_PISCA_ESQ = 22;
const int LED_PISCA_DIR = 21;
const int LED_FREIO     = 19;
const int LED_STATUS    = 2;   // LED azul: aceso = algum celular/site conectado

// ======================= AJUSTES =======================
// Se o motor for de 3 V ou 4,5 V, diminua (duty_max = V_motor / 7 V x 255)
const int VEL_FRENTE[3] = {140, 190, 255};
const int VEL_RE        = 170;
const int VEL_DIRECAO   = 200;
const unsigned long TEMPO_PISCA = 400;   // ms

// ======================= ESTADO =======================
enum Movimento { PARADO, FRENTE, RE };
Movimento movimento = PARADO;
char direcao = 'C';
int  marcha  = 0;
bool farolLigado = false;

bool piscaAceso = false;
unsigned long ultimoPisca = 0;
bool estavaConectado = false;

// ======================= BLE =======================
BLECharacteristic* caracTX = nullptr;
volatile bool bleConectado = false;
volatile bool precisaAnunciar = false;

// Fila simples: o BLE recebe as letras "em paralelo" e o loop() trata.
const int TAM_FILA = 64;
volatile char fila[TAM_FILA];
volatile int filaIni = 0, filaFim = 0;

void colocarNaFila(char c) {
  int prox = (filaFim + 1) % TAM_FILA;
  if (prox != filaIni) {          // se a fila encher, descarta
    fila[filaFim] = c;
    filaFim = prox;
  }
}

bool tirarDaFila(char &c) {
  if (filaIni == filaFim) return false;
  c = fila[filaIni];
  filaIni = (filaIni + 1) % TAM_FILA;
  return true;
}

// Chamado quando o site ESCREVE no RX
class RecebeCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    auto valor = c->getValue();   // String (core 3.x) ou std::string (core 2.x)
    for (size_t i = 0; i < valor.length(); i++) colocarNaFila(valor[i]);
  }
};

// Chamado quando o site conecta / desconecta
class ServidorCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* s) override { bleConectado = true; }
  void onDisconnect(BLEServer* s) override {
    bleConectado = false;
    precisaAnunciar = true;       // volta a aparecer para o proximo conectar
  }
};

void iniciarBLE() {
  BLEDevice::init(NOME_BT);
  BLEServer* servidor = BLEDevice::createServer();
  servidor->setCallbacks(new ServidorCallbacks());

  BLEService* servico = servidor->createService(UUID_SERVICO);

  caracTX = servico->createCharacteristic(UUID_TX, BLECharacteristic::PROPERTY_NOTIFY);
  caracTX->addDescriptor(new BLE2902());

  BLECharacteristic* caracRX = servico->createCharacteristic(
      UUID_RX, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  caracRX->setCallbacks(new RecebeCallbacks());

  servico->start();

  BLEAdvertising* anuncio = BLEDevice::getAdvertising();
  anuncio->addServiceUUID(UUID_SERVICO);
  anuncio->setScanResponse(true);
  BLEDevice::startAdvertising();
}

// Avisa o site o estado atual (4 letras)
void enviarEstadoBLE() {
  if (!bleConectado || caracTX == nullptr) return;
  char estado[5];
  estado[0] = (movimento == FRENTE) ? 'F' : (movimento == RE ? 'B' : 'S');
  estado[1] = '1' + marcha;
  estado[2] = direcao;
  estado[3] = farolLigado ? '1' : '0';
  estado[4] = '\0';
  caracTX->setValue((uint8_t*)estado, 4);
  caracTX->notify();
}

// ==================================================================
//  MOTOR DE TRACAO
//    IN1  IN2  ENA        Resultado
//    HIGH LOW  PWM   ->   frente
//    LOW  HIGH PWM   ->   re
//    LOW  LOW  HIGH  ->   freio
// ==================================================================
void aplicarTracao() {
  switch (movimento) {
    case FRENTE:
      digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
      analogWrite(ENA, VEL_FRENTE[marcha]);
      break;
    case RE:
      digitalWrite(IN1, LOW);  digitalWrite(IN2, HIGH);
      analogWrite(ENA, VEL_RE);
      break;
    case PARADO:
    default:
      digitalWrite(IN1, LOW);  digitalWrite(IN2, LOW);
      analogWrite(ENA, 255);   // freio
      break;
  }
}

// ==================================================================
//  MOTOR DE DIRECAO (no centro fica solto: a mola centraliza)
// ==================================================================
void aplicarDirecao() {
  if (direcao == 'L') {
    digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
    analogWrite(ENB, VEL_DIRECAO);
  } else if (direcao == 'R') {
    digitalWrite(IN3, LOW);  digitalWrite(IN4, HIGH);
    analogWrite(ENB, VEL_DIRECAO);
  } else {
    digitalWrite(IN3, LOW);  digitalWrite(IN4, LOW);
    analogWrite(ENB, 0);
  }
}

// ==================================================================
//  LUZES (pisca com millis, sem delay)
// ==================================================================
void atualizarLuzes() {
  digitalWrite(LED_FREIO, movimento != FRENTE ? HIGH : LOW);
  if (direcao == 'L' || direcao == 'R') {
    if (millis() - ultimoPisca >= TEMPO_PISCA) {
      ultimoPisca = millis();
      piscaAceso = !piscaAceso;
    }
    digitalWrite(LED_PISCA_ESQ, (direcao == 'L' && piscaAceso) ? HIGH : LOW);
    digitalWrite(LED_PISCA_DIR, (direcao == 'R' && piscaAceso) ? HIGH : LOW);
  } else {
    piscaAceso = false;
    digitalWrite(LED_PISCA_ESQ, LOW);
    digitalWrite(LED_PISCA_DIR, LOW);
  }
}

// ==================================================================
//  INTERPRETA O COMANDO (vale para classico e BLE)
// ==================================================================
void tratarComando(char cmd) {
  switch (cmd) {
    case 'F': movimento = FRENTE; break;
    case 'B': movimento = RE;     break;
    case 'S': movimento = PARADO; break;

    case 'L': if (direcao != 'L') ultimoPisca = 0; direcao = 'L'; break;
    case 'R': if (direcao != 'R') ultimoPisca = 0; direcao = 'R'; break;
    case 'C': direcao = 'C'; break;

    case '1': marcha = 0; break;
    case '2': marcha = 1; break;
    case '3': marcha = 2; break;

    case 'H': farolLigado = true;  digitalWrite(LED_FAROL, HIGH); break;
    case 'h': farolLigado = false; digitalWrite(LED_FAROL, LOW);  break;

    case '?': break;          // o site pede o estado atual (so responde)
    default: return;          // ignora qualquer outra coisa (\n, espaco...)
  }

  aplicarTracao();
  aplicarDirecao();
  enviarEstadoBLE();

  Serial.print("Comando recebido: ");
  Serial.println(cmd);
}

void pararTudo() {
  movimento = PARADO;
  direcao = 'C';
  aplicarTracao();
  aplicarDirecao();
}

// ==================================================================
//  SETUP
// ==================================================================
void setup() {
  Serial.begin(115200);

  int saidas[] = {ENA, IN1, IN2, ENB, IN3, IN4,
                  LED_FAROL, LED_PISCA_ESQ, LED_PISCA_DIR, LED_FREIO, LED_STATUS};
  for (int pino : saidas) {
    pinMode(pino, OUTPUT);
    digitalWrite(pino, LOW);
  }
  pararTudo();

  iniciarBLE();               // primeiro o BLE (site)...
  SerialBT.begin(NOME_BT);    // ...depois o classico (app do App Inventor)

  Serial.print("Carrinho pronto! Bluetooth classico e BLE com o nome: ");
  Serial.println(NOME_BT);
}

// ==================================================================
//  LOOP
// ==================================================================
void loop() {
  // 1) Comandos do Bluetooth classico (app App Inventor)
  while (SerialBT.available()) {
    tratarComando((char)SerialBT.read());
  }

  // 2) Comandos do BLE (site)
  char c;
  while (tirarDaFila(c)) {
    tratarComando(c);
  }

  // 3) Volta a anunciar o BLE depois que o site desconecta
  if (precisaAnunciar) {
    precisaAnunciar = false;
    delay(100);
    BLEDevice::startAdvertising();
  }

  // 4) Seguranca: se TODOS desconectarem, o carrinho para sozinho
  bool conectado = SerialBT.hasClient() || bleConectado;
  if (estavaConectado && !conectado) {
    pararTudo();
    Serial.println("Desconectou -> carrinho parado");
  }
  estavaConectado = conectado;
  digitalWrite(LED_STATUS, conectado ? HIGH : LOW);

  // 5) Luzes
  atualizarLuzes();
}
