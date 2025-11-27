// Camada de comunicação serial de baixo nível
let serialPort = null;
let serialReader = null;
let serialWriter = null;
let serialEncoder = new TextEncoder();
let serialConnected = false;

const SERIAL_PROMPT = "esp32s3>";
const SERIAL_BAUD = 115200;
const SERIAL_TIMEOUT_MS = 2000;

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function atualizarStatusSerial(texto) {
  const el = document.getElementById("serialStatus");
  if (el) el.textContent = texto;
}

export async function conectarSerial() {
  if (!("serial" in navigator)) {
    alert("Este navegador não suporta Web Serial API.\nUse Chrome ou Edge.");
    return;
  }

  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: SERIAL_BAUD });

    const decoder = new TextDecoderStream();
    serialPort.readable.pipeTo(decoder.writable);
    serialReader = decoder.readable.getReader();

    serialWriter = serialPort.writable.getWriter();

    serialConnected = true;
    atualizarStatusSerial("Conectado");
  } catch (e) {
    console.error(e);
    alert("Falha ao conectar na serial:\n" + e);
  }
}

export async function desconectarSerial() {
  serialConnected = false;
  try { await serialReader?.cancel(); } catch (_) {}
  try { serialWriter?.releaseLock(); } catch (_) {}
  try { await serialPort?.close(); } catch (_) {}

  serialPort = null;
  serialReader = null;
  serialWriter = null;

  atualizarStatusSerial("Desconectado");
}

export async function enviarComandoSerial(comando, timeoutMs = SERIAL_TIMEOUT_MS) {
  if (!serialConnected || !serialWriter || !serialReader) {
    await conectarSerial();
    if (!serialConnected) throw new Error("Serial não conectada");
  }

  const cmd = comando.trim() + "\r\n";
  await serialWriter.write(serialEncoder.encode(cmd));

  let buffer = "";
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await Promise.race([
      serialReader.read(),
      new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 200))
    ]);

    if (!result) break;
    if (result.timeout) break;
    if (result.done) break;
    if (result.value) {
      buffer += result.value;
      if (buffer.includes(SERIAL_PROMPT)) break;
    }
  }

  return limparEcoEPrompt(buffer, comando);
}

function limparEcoEPrompt(saida, comandoOriginal) {
  if (!saida) return "";
  let texto = saida.replace(/\r/g, "");

  const linhas = texto
    .split("\n")
    .map(l => l.trimEnd())
    .filter(l => l.length > 0);

  const semEco = linhas.filter(l => !l.startsWith(comandoOriginal));
  const semPrompt = semEco.filter(l => !l.includes(SERIAL_PROMPT));

  return semPrompt.join("\n");
}

// Apenas raiz: "/NOME.ext"
export function normalizarNomeArquivoRoot(nome) {
  const base = nome.trim().replace(/^\/+/, "").split("/").pop();
  return "/" + base;
}

export function escaparTextoFedit(text) {
  let t = text.replace(/\\/g, "\\\\");
  t = t.replace(/"/g, '\\"');
  return t;
}
