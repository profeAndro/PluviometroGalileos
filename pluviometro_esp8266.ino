/*
  PLUVIÓMETRO DIGITAL - NodeMCU ESP8266
  ---------------------------------------
  Cuenta los vuelcos del balancín (tipping bucket) y publica
  el acumulado de lluvia en milímetros por WiFi, para que la
  app de registro lo lea automáticamente (sin cables).

  Placa: NodeMCU ESP8266MOD (CP2102, 30 pines)
  Librerías necesarias (vienen con el paquete de boards ESP8266):
    - ESP8266WiFi
    - ESP8266WebServer
  En el IDE de Arduino: Herramientas > Placa > NodeMCU 1.0 (ESP-12E Module)
*/
#include <LiquidCrystal.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

// ---------- CONFIGURACIÓN: completar antes de subir ----------
const char* ssid     = "Estudiantes";
const char* password = "educar_2018";

const int pinSensor = D3;          // pin con interrupción disponible en NodeMCU
const float mmPorVuelco = 5;     // <-- CALIBRAR: mm que representa cada vuelco del balancín
// ---------------------------------------------------------------

volatile int vuelcos = 0;

ESP8266WebServer server(80);

// Se ejecuta cada vez que el balancín vuelca y activa el sensor reed
void IRAM_ATTR contarVuelco() {
  vuelcos++;
}

// Responde con el acumulado actual en formato JSON
// Esto es lo que la app de registro consulta cada 10 segundos
void handleData() {
  server.sendHeader("Access-Control-Allow-Origin", "*"); // permite que la app lo lea
  float mmAcumulados = vuelcos * mmPorVuelco;
  String json = "{\"mm\":" + String(mmAcumulados, 2) +
                ",\"vuelcos\":" + String(vuelcos) +
                ",\"uptime_ms\":" + String(millis()) + "}";
  server.send(200, "application/json", json);
}

// Página simple para verificar desde el celular/PC que el sensor está vivo
void handleRoot() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String html = "<h2>Pluviometro Digital</h2><p>Vuelcos: " + String(vuelcos) +
                "</p><p>mm acumulados: " + String(vuelcos * mmPorVuelco, 2) +
                "</p><p>Endpoint de datos: <a href='/data'>/data</a></p>";
  server.send(200, "text/html", html);
}

void setup() {

  Serial.begin(9600);
  delay(200);

  pinMode(pinSensor, INPUT);
  attachInterrupt(digitalPinToInterrupt(pinSensor), contarVuelco, RISING);

  Serial.println();
  Serial.print("Conectando a WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("¡Conectado!");
  Serial.print("IP del sensor (cargar esta IP en la app): ");
  Serial.println(WiFi.localIP());

  server.on("/", handleRoot);
  server.on("/data", handleData);
  server.begin();
  Serial.println("Servidor web iniciado en el puerto 80.");
}

void loop() {
  server.handleClient();
}
