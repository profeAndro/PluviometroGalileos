/*
  ============================================================
   SERVIDOR - ESTACIÓN DE LLUVIA
  ============================================================
  ¿Qué hace este archivo?
  Es el "puente" entre el Arduino y la página web:

    Arduino (por cable USB)  --->  Este servidor  --->  Celular / Compu

  El servidor:
    1. Se conecta al puerto serie donde está el Arduino.
    2. Lee cada línea de datos (en formato JSON) que manda el Arduino.
    3. Guarda un historial simple en memoria.
    4. Envía esos datos en tiempo real a todas las pantallas
       conectadas (usando "sockets", que son como un teléfono
       siempre abierto entre el servidor y el navegador).
    5. Sirve la página web (carpeta "public").
  ============================================================
*/

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

// ---------- CONFIGURACIÓN ----------
// Cambia esto por el puerto donde está conectado tu Arduino.
// En Windows suele ser algo como "COM3".
// En Mac/Linux suele ser algo como "/dev/ttyUSB0" o "/dev/ttyACM0".
const NOMBRE_PUERTO = process.env.PUERTO_ARDUINO || "/dev/ttyACM0";
const VELOCIDAD_BAUDIOS = 9600;
const PUERTO_WEB = process.env.PORT || 3000;


/**
 * Clase EstacionLluvia
 * ---------------------
 * Se encarga de todo lo relacionado con la conexión al Arduino
 * y de guardar el historial reciente de lluvia.
 * Pensarla como "el cuaderno de notas" de la estación:
 * anota cada lectura y avisa cuando llega una nueva.
 */
class EstacionLluvia {
  constructor() {
    this.historial = [];        // Guardamos las últimas lecturas
    this.maximoHistorial = 200; // No dejamos crecer la lista sin límite
    this.mmAcumuladoHoy = 0;
    this.conectado = false;
    this.alRecibirDato = null;  // Aquí guardamos una función "avisadora"
  }

  /** Se llama cada vez que llega una lectura nueva del Arduino */
  registrarLectura(datos) {
    const lectura = {
      hora: new Date().toISOString(),
      mmIntervalo: datos.mm_intervalo ?? 0,
      mmAcumulado: datos.mm_acumulado ?? this.mmAcumuladoHoy,
    };

    this.mmAcumuladoHoy = lectura.mmAcumulado;
    this.historial.push(lectura);

    if (this.historial.length > this.maximoHistorial) {
      this.historial.shift(); // quitamos la lectura más vieja
    }

    // Si alguien está "escuchando" (el servidor web), le avisamos
    if (this.alRecibirDato) {
      this.alRecibirDato(lectura);
    }
  }

  obtenerEstadoActual() {
    return {
      conectado: this.conectado,
      mmAcumuladoHoy: this.mmAcumuladoHoy,
      historial: this.historial,
    };
  }
}

const estacion = new EstacionLluvia();

// ---------- CONEXIÓN AL ARDUINO ----------
function conectarArduino() {
  const puerto = new SerialPort({ path: NOMBRE_PUERTO, baudRate: VELOCIDAD_BAUDIOS });
  const lector = puerto.pipe(new ReadlineParser({ delimiter: "\n" }));

  puerto.on("open", () => {
    estacion.conectado = true;
    console.log(`✅ Conectado al Arduino en ${NOMBRE_PUERTO}`);
  });

  puerto.on("error", (error) => {
    estacion.conectado = false;
    console.log(`⚠️  No se pudo conectar al Arduino: ${error.message}`);
    console.log("   Revisa el puerto en PUERTO_ARDUINO y vuelve a intentar.");
  });

  puerto.on("close", () => {
    estacion.conectado = false;
    console.log("🔌 Se desconectó el Arduino. Reintentando en 5 segundos...");
    setTimeout(conectarArduino, 5000);
  });

  lector.on("data", (linea) => {
    try {
      const datos = JSON.parse(linea.trim());
      if (datos.mm_intervalo !== undefined) {
        estacion.registrarLectura(datos);
      }
    } catch (error) {
      // Si la línea no es JSON válido (ej: un mensaje de arranque), la ignoramos
    }
  });
}

conectarArduino();

// ---------- SERVIDOR WEB ----------
const app = express();
const servidorHttp = http.createServer(app);
const io = new Server(servidorHttp);

app.use(express.static("public"));

// Cuando un celular o compu se conecta a la página...
io.on("connection", (socket) => {
  console.log("📱 Una pantalla se conectó al tablero");

  // Le mandamos de inmediato el estado actual (para que no vea la pantalla vacía)
  socket.emit("estado_inicial", estacion.obtenerEstadoActual());
});

// Cada vez que llega un dato nuevo del Arduino, lo mandamos a TODAS las pantallas
estacion.alRecibirDato = (lectura) => {
  io.emit("nueva_lectura", lectura);
};

servidorHttp.listen(PUERTO_WEB, () => {
  console.log(`🌧️  Tablero de lluvia disponible en http://localhost:${PUERTO_WEB}`);
  console.log("   Para verlo desde el celular, usa la IP de esta compu en tu wifi,");
  console.log(`   por ejemplo: http://192.168.1.XX:${PUERTO_WEB}`);
});
