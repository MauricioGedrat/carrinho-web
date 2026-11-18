"use client";

import { useRef, type ReactNode } from "react";

interface BotaoSegurarProps {
  rotulo: string;
  icone: ReactNode;
  ativo: boolean;
  desabilitado?: boolean;
  aoApertar: () => void;
  aoSoltar: () => void;
  /** Tecla do teclado que faz a mesma coisa (só para mostrar) */
  atalho?: string;
  tom?: "normal" | "re";
  className?: string;
}

/**
 * Botão de "segurar": aciona ao apertar e solta ao tirar o dedo,
 * como o pedal do acelerador. Funciona com toque, mouse e teclado.
 */
export function BotaoSegurar({
  rotulo,
  icone,
  ativo,
  desabilitado = false,
  aoApertar,
  aoSoltar,
  atalho,
  tom = "normal",
  className = "",
}: BotaoSegurarProps) {
  const segurando = useRef(false);

  const apertar = () => {
    if (desabilitado || segurando.current) return;
    segurando.current = true;
    aoApertar();
  };

  const soltar = () => {
    if (!segurando.current) return;
    segurando.current = false;
    aoSoltar();
  };

  const corAtiva =
    tom === "re"
      ? "bg-freio text-white shadow-[inset_0_4px_0_rgba(0,0,0,0.25)]"
      : "bg-giallo text-asfalto ring-[3px] ring-inset ring-asfalto";

  return (
    <button
      type="button"
      aria-pressed={ativo}
      aria-label={atalho ? `${rotulo} (tecla ${atalho})` : rotulo}
      disabled={desabilitado}
      onPointerDown={(e) => {
        if (desabilitado) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        apertar();
      }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onLostPointerCapture={soltar}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          apertar();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          soltar();
        }
      }}
      className={[
        "group relative flex touch-none select-none flex-col items-center justify-center gap-1",
        "rounded-[1.75rem] border-b-[6px] font-semibold transition-[transform,background-color] duration-75",
        "focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-asfalto",
        "disabled:cursor-not-allowed disabled:opacity-40",
        ativo
          ? `translate-y-[4px] border-b-[2px] border-black/30 ${corAtiva}`
          : "border-black/45 bg-asfalto text-giallo active:translate-y-[4px]",
        className,
      ].join(" ")}
    >
      <span className="h-9 w-9 sm:h-11 sm:w-11" aria-hidden>
        {icone}
      </span>
      <span className="text-lg leading-none sm:text-xl">{rotulo}</span>
      {atalho && (
        <span className="hidden text-xs font-medium opacity-60 [@media(hover:hover)]:block">{atalho}</span>
      )}
    </button>
  );
}
