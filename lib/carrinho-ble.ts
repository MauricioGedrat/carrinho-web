/**
 * Conexão com o carrinho por Web Bluetooth (BLE).
 *
 * O ESP32 (firmware carrinho_web.ino) expõe o serviço "Nordic UART":
 *  - RX: o site escreve as letras de comando (F, B, S, L, R, C, 1, 2, 3, H, h, ?)
 *  - TX: o ESP32 avisa o estado atual em 4 letras, ex.: "F2C1"
 */

export const UUID_SERVICO = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
export const UUID_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
export const UUID_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

/** Letras que o carrinho entende. */
export type Comando =
  | "F" | "B" | "S" // tração: frente, ré, parar
  | "L" | "R" | "C" // direção: esquerda, direita, centro
  | "1" | "2" | "3" // velocidade
  | "H" | "h" // farol liga / desliga
  | "?"; // pede o estado atual

export type Movimento = "F" | "B" | "S";
export type Direcao = "L" | "R" | "C";
export type Velocidade = 1 | 2 | 3;

/** Estado que o carrinho informa pelo TX. */
export interface EstadoCarrinho {
  movimento: Movimento;
  velocidade: Velocidade;
  direcao: Direcao;
  farol: boolean;
}

export const ESTADO_INICIAL: EstadoCarrinho = {
  movimento: "S",
  velocidade: 1,
  direcao: "C",
  farol: false,
};

/** O navegador tem Web Bluetooth? (Chrome/Edge no Android e no PC) */
export function webBluetoothDisponivel(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

/** Converte "F2C1" em objeto. Retorna null se vier algo inesperado. */
export function lerEstado(texto: string): EstadoCarrinho | null {
  if (texto.length < 4) return null;
  const [m, v, d, f] = texto;
  if (!"FBS".includes(m) || !"123".includes(v) || !"LRC".includes(d)) return null;
  return {
    movimento: m as Movimento,
    velocidade: Number(v) as Velocidade,
    direcao: d as Direcao,
    farol: f === "1",
  };
}

/**
 * Calcula o novo estado depois de um comando, sem esperar o ESP32.
 * Assim o desenho reage na hora; quando o carrinho responde, vale o que ele disser.
 */
export function aplicarComando(estado: EstadoCarrinho, comando: Comando): EstadoCarrinho {
  switch (comando) {
    case "F":
    case "B":
    case "S":
      return { ...estado, movimento: comando };
    case "L":
    case "R":
    case "C":
      return { ...estado, direcao: comando };
    case "1":
    case "2":
    case "3":
      return { ...estado, velocidade: Number(comando) as Velocidade };
    case "H":
      return { ...estado, farol: true };
    case "h":
      return { ...estado, farol: false };
    default:
      return estado;
  }
}

interface Eventos {
  aoMudarEstado: (estado: EstadoCarrinho) => void;
  aoDesconectar: () => void;
}

export class ConexaoCarrinho {
  private dispositivo: BluetoothDevice | null = null;
  private rx: BluetoothRemoteGATTCharacteristic | null = null;
  private tx: BluetoothRemoteGATTCharacteristic | null = null;
  /** Fila de escrita: o BLE só aceita uma operação por vez. */
  private fila: Promise<void> = Promise.resolve();
  private readonly codificador = new TextEncoder();
  private readonly decodificador = new TextDecoder();

  constructor(private readonly eventos: Eventos) {}

  get conectado(): boolean {
    return this.dispositivo?.gatt?.connected ?? false;
  }

  get nome(): string {
    return this.dispositivo?.name ?? "Carrinho";
  }

  /** Abre a janela do navegador para escolher o carrinho e conecta. */
  async conectar(): Promise<void> {
    const dispositivo = await navigator.bluetooth.requestDevice({
      filters: [{ services: [UUID_SERVICO] }, { namePrefix: "Carrinho" }],
      optionalServices: [UUID_SERVICO],
    });

    dispositivo.addEventListener("gattserverdisconnected", this.tratarDesconexao);
    this.dispositivo = dispositivo;

    const servidor = await dispositivo.gatt!.connect();
    const servico = await servidor.getPrimaryService(UUID_SERVICO);
    this.rx = await servico.getCharacteristic(UUID_RX);
    this.tx = await servico.getCharacteristic(UUID_TX);

    await this.tx.startNotifications();
    this.tx.addEventListener("characteristicvaluechanged", this.tratarNotificacao);

    await this.enviar("?"); // pede o estado atual
  }

  /** Envia uma letra. As escritas entram numa fila para não se atropelarem. */
  enviar(comando: Comando): Promise<void> {
    this.fila = this.fila
      .then(async () => {
        const rx = this.rx;
        if (!rx || !this.conectado) return;
        const dados = this.codificador.encode(comando);
        if (rx.properties.writeWithoutResponse) {
          await rx.writeValueWithoutResponse(dados);
        } else {
          await rx.writeValue(dados);
        }
      })
      .catch((erro: unknown) => {
        console.warn("Falha ao enviar comando", comando, erro);
      });
    return this.fila;
  }

  async desconectar(): Promise<void> {
    if (this.conectado) {
      await this.enviar("S");
      await this.enviar("C");
      this.dispositivo?.gatt?.disconnect();
    }
  }

  private tratarNotificacao = (evento: Event): void => {
    const caracteristica = evento.target as BluetoothRemoteGATTCharacteristic;
    if (!caracteristica.value) return;
    const estado = lerEstado(this.decodificador.decode(caracteristica.value));
    if (estado) this.eventos.aoMudarEstado(estado);
  };

  private tratarDesconexao = (): void => {
    this.rx = null;
    this.tx = null;
    this.eventos.aoDesconectar();
  };
}
