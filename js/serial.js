// js/serial.js

let port = null;
let reader = null;
let writer = null;
let readBuffer = "";
let isConnected = false;

const textEncoder = new TextEncoder();

/**
 * Atualiza texto "Desconectado/Conectado" na UI
 */
function setSerialStatus(text) {
  const el = document.getElementById("serialStatus");
  if (el) el.textContent = text;
}

/**
 * Pequeno helper de delay
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Garante formato "/NOME.ext" e elimina diretórios.
 */
export function normalizarNomeArquivoRoot(nome) {
  if (!nome) return "/unnamed.json";
  let base = nome.trim();
  base = base.replace(/^["']|["']$/g, ""); // tira aspas externas se houver
  base = base.split(/[\\/]/).pop();        // só o último segmento
  if (!base.startsWith("/")) {
    base = "/" + base;
  }
  return base;
}

/**
 * Escapa texto para uso no fedit: fedit /temp.txt -t "AQUI"
 * - escapa \ e "
 * - mantém o restante igual
 */
export function escaparTextoFedit(texto) {
  if (texto == null) return "";
  return String(texto)
    .replace(/\\/g, "\\\\")  // barra invertida
    .replace(/"/g, '\\"');   // aspas duplas
}

/**
 * Conecta à porta serial usando Web Serial API
 */
export async function conectarSerial() {
  if (!("serial" in navigator)) {
    alert("Este navegador não suporta Web Serial API.");
    return;
  }

  try {
    // Se já está conectado, não tenta de novo
    if (port && isConnected) {
      alert("Já conectado à porta serial.");
      return;
    }

    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });

    // writer para enviar comandos
    writer = port.writable.getWriter();

    // reader para ler saída assíncrona
    reader = port.readable.getReader();
    readBuffer = "";
    isConnected = true;
    setSerialStatus("Conectado");

    // Inicia loop de leitura em background
    readLoop();

    alert("Conectado à porta serial.");
  } catch (err) {
    console.error("Erro ao conectar na serial:", err);
    alert("Erro ao conectar na serial:\n" + err);
  }
}

/**
 * Loop de leitura da serial: acumula tudo em readBuffer
 */
async function readLoop() {
  if (!reader) return;

  const textDecoder = new TextDecoder();

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        // reader.cancel() foi chamado ou porta fechou
        break;
      }
      if (value) {
        readBuffer += textDecoder.decode(value, { stream: true });
      }
    }
  } catch (err) {
    // Se cancelarmos o reader na desconexão, cai aqui
    if (err.name !== "NetworkError") {
      console.warn("Erro no readLoop da serial:", err);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch (_) {}
    reader = null;
  }
}

/**
 * Desconecta a porta serial **de verdade**, liberando para outros programas
 */
export async function desconectarSerial() {
  try {
    if (reader) {
      try {
        await reader.cancel(); // força read() a finalizar
      } catch (_) {}
      try {
        reader.releaseLock();
      } catch (_) {}
      reader = null;
    }

    if (writer) {
      try {
        writer.releaseLock();
      } catch (_) {}
      writer = null;
    }

    if (port) {
      try {
        await port.close();
      } catch (err) {
        console.warn("Erro ao fechar porta:", err);
      }
    }
  } finally {
    port = null;
    isConnected = false;
    readBuffer = "";
    setSerialStatus("Desconectado");
    console.log("Porta serial desconectada e liberada.");
  }
}

/**
 * Envia um comando via serial e aguarda um tempo, retornando o texto recebido.
 * Muito simples: limpa buffer antes, aguarda timeout e devolve o que chegou.
 *
 * @param {string} comando - texto do comando (sem \r\n)
 * @param {number} timeoutMs - tempo para acumular resposta
 */
export async function enviarComandoSerial(comando, timeoutMs = 1000) {
  if (!port || !writer || !isConnected) {
    throw new Error("Serial não está conectada.");
  }

  // limpa buffer antes de mandar
  readBuffer = "";

  const texto = comando.endsWith("\r") || comando.endsWith("\n")
    ? comando
    : comando + "\r\n";

  // envia
  await writer.write(textEncoder.encode(texto));

  // aguarda resposta simples por tempo fixo
  await delay(timeoutMs);

  // devolve o que tiver sido lido até agora
  return readBuffer;
}
