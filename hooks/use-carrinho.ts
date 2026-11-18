"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  aplicarComando,
  ConexaoCarrinho,
  ESTADO_INICIAL,
  webBluetoothDisponivel,
  type Comando,
  type EstadoCarrinho,
} from "@/lib/carrinho-ble";

export type StatusConexao = "desconectado" | "conectando" | "conectado";

const inscreverNada = () => () => {};

export function useCarrinho() {
  // Só sabemos se o navegador tem Bluetooth depois de rodar no cliente
  const suportado = useSyncExternalStore(inscreverNada, webBluetoothDisponivel, () => true);

  const [status, setStatus] = useState<StatusConexao>("desconectado");
  const [estado, setEstado] = useState<EstadoCarrinho>(ESTADO_INICIAL);
  const [nome, setNome] = useState<string>("");
  const [erro, setErro] = useState<string>("");
  const conexao = useRef<ConexaoCarrinho | null>(null);

  const conectar = useCallback(async () => {
    setErro("");
    setStatus("conectando");
    const nova = new ConexaoCarrinho({
      aoMudarEstado: setEstado,
      aoDesconectar: () => {
        setStatus("desconectado");
        setEstado(ESTADO_INICIAL);
      },
    });
    try {
      await nova.conectar();
      conexao.current = nova;
      setNome(nova.nome);
      setStatus("conectado");
    } catch (e) {
      setStatus("desconectado");
      const mensagem = e instanceof Error ? e.message : String(e);
      // Fechar a janela sem escolher não é erro
      if (/cancel/i.test(mensagem)) return;
      setErro(
        "Não deu para conectar. Confira se o carrinho está ligado, perto do aparelho e sem outro celular conectado nele.",
      );
    }
  }, []);

  const desconectar = useCallback(async () => {
    await conexao.current?.desconectar();
  }, []);

  // Atualiza o desenho na hora e, se houver carrinho conectado, manda a letra
  const enviar = useCallback((comando: Comando) => {
    setEstado((atual) => aplicarComando(atual, comando));
    if (conexao.current?.conectado) void conexao.current.enviar(comando);
  }, []);

  // Segurança: se a aba perder o foco no meio de um comando, o carrinho para
  useEffect(() => {
    const parar = () => {
      if (conexao.current?.conectado) {
        void conexao.current.enviar("S");
        void conexao.current.enviar("C");
      }
    };
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "hidden") parar();
    };
    window.addEventListener("blur", parar);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      window.removeEventListener("blur", parar);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, []);

  return { suportado, status, estado, nome, erro, conectar, desconectar, enviar };
}
