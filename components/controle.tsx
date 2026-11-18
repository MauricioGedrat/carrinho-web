"use client";

import { useEffect, useRef } from "react";
import { BotaoSegurar } from "@/components/botao-segurar";
import { Carro } from "@/components/carro";
import { useCarrinho } from "@/hooks/use-carrinho";
import type { Velocidade } from "@/lib/carrinho-ble";

const Seta = ({ rotacao }: { rotacao: number }) => (
  <svg viewBox="0 0 24 24" className="h-full w-full" style={{ transform: `rotate(${rotacao}deg)` }}>
    <path d="M12 3 L21 15 H15 V21 H9 V15 H3 Z" fill="currentColor" />
  </svg>
);

const TECLAS_TRACAO: Record<string, "F" | "B"> = { ArrowUp: "F", w: "F", W: "F", ArrowDown: "B", s: "B", S: "B" };
const TECLAS_DIRECAO: Record<string, "L" | "R"> = { ArrowLeft: "L", a: "L", A: "L", ArrowRight: "R", d: "R", D: "R" };

function descreverMovimento(movimento: string, velocidade: number) {
  if (movimento === "F") return `Andando para frente na velocidade ${velocidade}`;
  if (movimento === "B") return "Dando ré";
  return "Parado, com freio";
}

export function Controle() {
  const { suportado, status, estado, nome, erro, conectar, desconectar, enviar } = useCarrinho();
  const conectado = status === "conectado";

  // Teclado (no PC): setas ou WASD, 1/2/3 para velocidade, H para o farol
  const teclaTracao = useRef<string | null>(null);
  const teclaDirecao = useRef<string | null>(null);
  const farolRef = useRef(estado.farol);
  useEffect(() => {
    farolRef.current = estado.farol;
  }, [estado.farol]);

  useEffect(() => {
    const aoApertar = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (TECLAS_TRACAO[e.key]) {
        e.preventDefault();
        teclaTracao.current = e.key;
        enviar(TECLAS_TRACAO[e.key]);
      } else if (TECLAS_DIRECAO[e.key]) {
        e.preventDefault();
        teclaDirecao.current = e.key;
        enviar(TECLAS_DIRECAO[e.key]);
      } else if (e.key === "1" || e.key === "2" || e.key === "3") {
        enviar(e.key);
      } else if (e.key === "h" || e.key === "H") {
        enviar(farolRef.current ? "h" : "H");
      }
    };
    const aoSoltar = (e: KeyboardEvent) => {
      if (e.key === teclaTracao.current) {
        teclaTracao.current = null;
        enviar("S");
      } else if (e.key === teclaDirecao.current) {
        teclaDirecao.current = null;
        enviar("C");
      }
    };
    window.addEventListener("keydown", aoApertar);
    window.addEventListener("keyup", aoSoltar);
    return () => {
      window.removeEventListener("keydown", aoApertar);
      window.removeEventListener("keyup", aoSoltar);
    };
  }, [enviar]);

  const escolherVelocidade = (v: Velocidade) => enviar(String(v) as "1" | "2" | "3");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-3 p-3 sm:gap-4 sm:p-5">
      {/* Barra de conexão */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 border-asfalto ${
              conectado ? "bg-verde" : status === "conectando" ? "animate-pulse bg-white" : "bg-transparent"
            }`}
          />
          <p className="truncate text-lg font-semibold leading-tight sm:text-xl" aria-live="polite">
            {conectado ? (
              <>
                {nome}
                <span className="sr-only"> conectado</span>
              </>
            ) : status === "conectando" ? (
              "Procurando o carrinho…"
            ) : (
              "Desconectado"
            )}
          </p>
        </div>
        {conectado ? (
          <button
            type="button"
            onClick={() => void desconectar()}
            className="shrink-0 rounded-full border-[3px] border-asfalto px-5 py-2 text-base font-semibold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-asfalto"
          >
            Desconectar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void conectar()}
            disabled={!suportado || status === "conectando"}
            className="shrink-0 rounded-full bg-asfalto px-5 py-2.5 text-base font-semibold text-giallo focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-asfalto disabled:opacity-40"
          >
            Conectar ao carrinho
          </button>
        )}
      </header>

      {!suportado && (
        <p role="alert" className="rounded-2xl border-[3px] border-asfalto bg-white/70 px-4 py-3 text-base">
          Este navegador não tem Bluetooth para sites. Abra esta página no <strong>Chrome</strong> ou no{" "}
          <strong>Edge</strong>, no Android ou no computador. No iPhone não funciona.
        </p>
      )}
      {erro && (
        <p role="alert" className="rounded-2xl border-[3px] border-freio bg-white/70 px-4 py-3 text-base">
          {erro}
        </p>
      )}

      {/* Controle */}
      <main className="grid flex-1 grid-cols-2 gap-3 sm:gap-5 landscape:grid-cols-[1fr_minmax(0,1.15fr)_1fr]">
        {/* Painel do meio: o carrinho, velocidade e farol */}
        <section
          aria-label="Painel do carrinho"
          className="col-span-2 flex flex-col items-center justify-center gap-3 landscape:order-2 landscape:col-span-1"
        >
          <Carro estado={estado} />
          <p className="text-center text-base font-medium" aria-live="polite">
            {descreverMovimento(estado.movimento, estado.velocidade)}
          </p>
          {!conectado && (
            <p className="-mt-2 text-center text-sm opacity-75">
              Modo demonstração: conecte para controlar o carrinho de verdade
            </p>
          )}

          <div className="flex w-full max-w-sm items-stretch gap-3">
            <fieldset className="flex flex-1 overflow-hidden rounded-2xl border-[3px] border-asfalto">
              <legend className="sr-only">Velocidade</legend>
              {([1, 2, 3] as Velocidade[]).map((v) => {
                const ativa = estado.velocidade === v;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={ativa}
                    aria-label={`Velocidade ${v}`}
                    onClick={() => escolherVelocidade(v)}
                    className={`flex flex-1 flex-col items-center py-1.5 focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-asfalto disabled:opacity-40 ${
                      ativa ? "bg-asfalto text-giallo" : ""
                    }`}
                  >
                    <span className="text-2xl font-extrabold leading-none tabular-nums">{v}</span>
                    <span className="text-[0.7rem] font-semibold">{v === 1 ? "lenta" : v === 2 ? "média" : "máxima"}</span>
                  </button>
                );
              })}
            </fieldset>

            <button
              type="button"
              aria-pressed={estado.farol}
              onClick={() => enviar(estado.farol ? "h" : "H")}
              className={`flex w-24 flex-col items-center justify-center rounded-2xl border-[3px] border-asfalto font-semibold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-asfalto disabled:opacity-40 ${
                estado.farol ? "bg-farol" : ""
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
                <path d="M9 5c-4 0-6 3-6 7s2 7 6 7h2V5H9z" fill="currentColor" />
                <path d="M14 7l7-2M14 12h8M14 17l7 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-sm">Farol</span>
            </button>
          </div>
        </section>

        {/* Polegar esquerdo: acelerar */}
        <section aria-label="Frente e ré" className="flex flex-col gap-3 landscape:order-1">
          <BotaoSegurar
            rotulo="Frente"
            atalho="↑ ou W"
            icone={<Seta rotacao={0} />}
            ativo={estado.movimento === "F"}
            aoApertar={() => enviar("F")}
            aoSoltar={() => enviar("S")}
            className="flex-[1.4]"
          />
          <BotaoSegurar
            rotulo="Ré"
            atalho="↓ ou S"
            tom="re"
            icone={<Seta rotacao={180} />}
            ativo={estado.movimento === "B"}
            aoApertar={() => enviar("B")}
            aoSoltar={() => enviar("S")}
            className="flex-1"
          />
        </section>

        {/* Polegar direito: direção */}
        <section aria-label="Direção" className="flex gap-3 landscape:order-3">
          <BotaoSegurar
            rotulo="Esquerda"
            atalho="← ou A"
            icone={<Seta rotacao={-90} />}
            ativo={estado.direcao === "L"}
            aoApertar={() => enviar("L")}
            aoSoltar={() => enviar("C")}
            className="flex-1"
          />
          <BotaoSegurar
            rotulo="Direita"
            atalho="→ ou D"
            icone={<Seta rotacao={90} />}
            ativo={estado.direcao === "R"}
            aoApertar={() => enviar("R")}
            aoSoltar={() => enviar("C")}
            className="flex-1"
          />
        </section>
      </main>

      <footer className="text-center text-sm opacity-75 [@media(max-height:520px)]:hidden">
        Segure o botão para andar e solte para parar. No computador: setas ou W A S D, teclas 1, 2 e 3 para a velocidade e H para o farol.
      </footer>
    </div>
  );
}
