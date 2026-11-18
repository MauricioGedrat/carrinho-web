import type { CSSProperties } from "react";
import type { EstadoCarrinho } from "@/lib/carrinho-ble";

interface CarroProps {
  estado: EstadoCarrinho;
}

/** Tempo que uma faixa da estrada leva para passar: quanto menor, mais rápido */
const TEMPO_FAIXA = { 1: "0.9s", 2: "0.55s", 3: "0.3s" } as const;

/**
 * O carrinho visto de cima, em cima de uma estrada.
 * - Frente/ré: a estrada corre para baixo/para cima (velocidade 1, 2 ou 3)
 * - Esquerda/direita: as rodas da frente viram, o pisca daquele lado pisca
 *   e, se estiver andando, o carro inclina para o lado da curva
 * - Freio/ré: lanternas vermelhas acesas; farol: fachos de luz na frente
 */
export function Carro({ estado }: CarroProps) {
  const { movimento, direcao, velocidade, farol } = estado;
  const andando = movimento !== "S";
  const freio = movimento !== "F";
  const piscaEsq = direcao === "L";
  const piscaDir = direcao === "R";
  const anguloRoda = direcao === "L" ? -22 : direcao === "R" ? 22 : 0;
  // Na ré o carro inclina para o lado contrário, como um carro de verdade
  const sentido = movimento === "B" ? -1 : 1;
  const inclinacao = andando ? (direcao === "L" ? -7 : direcao === "R" ? 7 : 0) * sentido : 0;

  const estrada: CSSProperties = {
    animationDuration: TEMPO_FAIXA[velocidade],
    animationDirection: movimento === "B" ? "reverse" : "normal",
    animationPlayState: andando ? "running" : "paused",
  };

  return (
    <svg
      viewBox="-50 -46 300 376"
      role="img"
      aria-label="Desenho do carrinho mostrando as luzes, a direção e o movimento"
      className="h-full max-h-[52vh] w-auto landscape:max-h-[46vh]"
    >
      <defs>
        <linearGradient id="facho" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FFF7D6" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFF7D6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sumir" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.15" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.85" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="bordas">
          <rect x="-50" y="-46" width="300" height="376" fill="url(#sumir)" />
        </mask>
      </defs>

      {/* estrada: faixas tracejadas que correm conforme o carro anda */}
      <g mask="url(#bordas)" stroke="#26272B" strokeOpacity="0.35" strokeWidth="6" strokeLinecap="round">
        {[-30, 230].map((x) => (
          <line
            key={x}
            x1={x}
            y1={-60}
            x2={x}
            y2={344}
            strokeDasharray="26 22"
            className="animate-estrada"
            style={estrada}
          />
        ))}
      </g>

      {/* o carro inteiro inclina nas curvas */}
      <g
        style={{
          transform: `rotate(${inclinacao}deg)`,
          transformBox: "fill-box",
          transformOrigin: "center",
          transition: "transform 250ms ease-out",
        }}
      >
        {/* fachos dos faróis */}
        <g className={`transition-opacity duration-200 ${farol ? "opacity-100" : "opacity-0"}`}>
          <path d="M58 22 L20 -40 L96 -40 L72 22 Z" fill="url(#facho)" />
          <path d="M128 22 L104 -40 L180 -40 L142 22 Z" fill="url(#facho)" />
        </g>

        {/* rodas dianteiras (viram com a direção) */}
        {[34, 166].map((x) => (
          <rect
            key={`d${x}`}
            x={x - 13}
            y={58}
            width={26}
            height={52}
            rx={8}
            fill="#26272B"
            style={{
              transform: `rotate(${anguloRoda}deg)`,
              transformBox: "fill-box",
              transformOrigin: "center",
              transition: "transform 150ms ease-out",
            }}
          />
        ))}
        {/* rodas traseiras */}
        {[34, 166].map((x) => (
          <rect key={`t${x}`} x={x - 14} y={222} width={28} height={58} rx={8} fill="#26272B" />
        ))}

        {/* carroceria */}
        <path
          d="M70 14 C40 18 32 40 32 64 L30 250 C30 292 52 314 100 316 C148 314 170 292 170 250 L168 64 C168 40 160 18 130 14 Z"
          fill="#F6C500"
          stroke="#26272B"
          strokeWidth="6"
        />
        {/* para-brisa e teto */}
        <path d="M58 104 C70 92 130 92 142 104 L150 150 L50 150 Z" fill="#26272B" />
        <rect x="54" y="150" width="92" height="70" rx="10" fill="#3B3D42" />
        <path d="M56 222 L144 222 L138 246 L62 246 Z" fill="#26272B" />

        {/* faróis */}
        <ellipse cx="62" cy="30" rx="15" ry="8" fill={farol ? "#FFF7D6" : "#C9C3A8"} stroke="#26272B" strokeWidth="3" />
        <ellipse cx="138" cy="30" rx="15" ry="8" fill={farol ? "#FFF7D6" : "#C9C3A8"} stroke="#26272B" strokeWidth="3" />

        {/* piscas: frente e trás de cada lado */}
        <g className={piscaEsq ? "animate-pisca" : ""} fill={piscaEsq ? "#FF9F1A" : "#8A6A33"}>
          <circle cx="38" cy="46" r="8" />
          <circle cx="38" cy="282" r="8" />
        </g>
        <g className={piscaDir ? "animate-pisca" : ""} fill={piscaDir ? "#FF9F1A" : "#8A6A33"}>
          <circle cx="162" cy="46" r="8" />
          <circle cx="162" cy="282" r="8" />
        </g>

        {/* luzes de freio / ré */}
        <rect x="56" y="294" width="34" height="11" rx="4" fill={freio ? "#E23B2E" : "#6E2A24"} stroke="#26272B" strokeWidth="3" />
        <rect x="110" y="294" width="34" height="11" rx="4" fill={freio ? "#E23B2E" : "#6E2A24"} stroke="#26272B" strokeWidth="3" />
      </g>
    </svg>
  );
}
