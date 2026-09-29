/*
  ============================================================
   PLUVIÓMETRO CON ARDUINO
  ============================================================
  ¿Qué hace este código?
  Un pluviómetro de "cangilón basculante" (tipping bucket) tiene
  una cucharita que se voltea cada vez que se llena con una
  cantidad fija de agua de lluvia. Cada vez que se voltea, cierra
  un circuito por un instante: eso es un "pulso" o "tip".

  Este programa:
    1. Cuenta esos pulsos usando una interrupción (para no
       perder ni un solo pulso, aunque sean muy rápidos).
    2. Convierte los pulsos en milímetros de lluvia.
    3. Envía los datos por el puerto serie (USB) en formato JSON,
       para que la computadora los pueda leer fácilmente.

  Conexión física:
    - Cable de señal del pluviómetro -> Pin 2 (debe ser un pin
      que soporte interrupciones: en Arduino Uno son el 2 y el 3)
    - Cable de tierra (GND) del pluviómetro -> GND del Arduino
    - El otro cable de señal normalmente va a 5V (revisa el
      manual de tu sensor específico)
  ============================================================
*/

// ---------- CONFIGURACIÓN QUE PUEDES AJUSTAR ----------

const byte PIN_PLUVIOMETRO = 2;      // Pin donde está conectado el sensor
const float MM_POR_PULSO = 0.2794;   // Milímetros de lluvia que representa
                                       // cada "tip". Este valor viene en la
                                       // ficha técnica de tu pluviómetro
                                       // (0.2794 mm es un valor típico).
const unsigned long INTERVALO_ENVIO_MS = 5000; // Cada cuánto se envían datos (5 s)


// ---------- VARIABLES INTERNAS ----------
// "volatile" es obligatorio para variables que cambian dentro
// de una interrupción, así el programa no las "cachea" mal.
volatile unsigned long contadorPulsos = 0;

unsigned long ultimoEnvio = 0;
unsigned long pulsosAcumuladosHoy = 0; // total del día (se reinicia a medianoche si agregas RTC)


// ---------- FUNCIÓN DE INTERRUPCIÓN ----------
// Esta función se ejecuta SOLA, automáticamente, cada vez que
// el sensor manda una señal. Debe ser muy corta y rápida.
void contarPulso() {
  contadorPulsos++;
}

void setup() {
  Serial.begin(9600);

  pinMode(PIN_PLUVIOMETRO, INPUT_PULLUP);

  // Le decimos al Arduino: "cuando el pin PLUVIOMETRO pase de
  // HIGH a LOW, llama a la función contarPulso()"
  attachInterrupt(digitalPinToInterrupt(PIN_PLUVIOMETRO), contarPulso, FALLING);

  Serial.println("{\"estado\":\"pluviometro_listo\"}");
}

void loop() {
  unsigned long ahora = millis();

  // Cada INTERVALO_ENVIO_MS milisegundos, calculamos y enviamos datos
  if (ahora - ultimoEnvio >= INTERVALO_ENVIO_MS) {
    ultimoEnvio = ahora;

    // Copiamos el contador con interrupciones apagadas un instante,
    // para evitar que cambie a la mitad de la lectura
    noInterrupts();
    unsigned long pulsos = contadorPulsos;
    contadorPulsos = 0; // lo reiniciamos: este envío es "lluvia desde el último envío"
    interrupts();

    pulsosAcumuladosHoy += pulsos;

    float mmDesdeUltimoEnvio = pulsos * MM_POR_PULSO;
    float mmAcumuladosHoy = pulsosAcumuladosHoy * MM_POR_PULSO;

    // Armamos el mensaje en formato JSON, fácil de leer por
    // cualquier programa (Node.js, Python, etc.)
    Serial.print("{");
    Serial.print("\"mm_intervalo\":");
    Serial.print(mmDesdeUltimoEnvio, 3);
    Serial.print(",\"mm_acumulado\":");
    Serial.print(mmAcumuladosHoy, 3);
    Serial.print(",\"pulsos\":");
    Serial.print(pulsos);
    Serial.println("}");
  }
}
