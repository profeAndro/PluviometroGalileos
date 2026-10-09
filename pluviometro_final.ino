/*
  PLUVIÓMETRO DIGITAL - NodeMCU ESP8266 + LCD I2C
  -------------------------------------------------
  Cuenta los vuelcos del balancín (tipping bucket) y:
    1) Muestra el acumulado en vivo en una pantalla LCD I2C (D1/D2)
    2) Sirve el dato por la red local en /data (para probar en el aula)
    3) Sube el acumulado a ThingSpeak por internet (para que la página
       publicada en GitHub Pages lo reciba desde cualquier lugar)

  Placa: NodeMCU ESP8266MOD (CP2102, 30 pines)

  CONEXIÓN DEL LCD (pantalla I2C 16x2, la de 4 pines con el módulo azul atrás):
    LCD GND -> GND          LCD VCC -> 3V3 (o 5V si tu módulo lo admite)
    LCD SDA -> D2           LCD SCL -> D1

  Librerías necesarias:
    - ESP8266WiFi, ESP8266WebServer, ESP8266HTTPClient, WiFiClient, Wire
      (vienen con el paquete de boards ESP8266)
    - "LiquidCrystal I2C" de Frank de Brabander
      -> Instalar desde el IDE: Herramientas > Administrar bibliotecas >
         buscar "LiquidCrystal I2C" > Instalar

  En el IDE de Arduino: Herramientas > Placa > NodeMCU 1.0 (ESP-12E Module)

  ⚠️ El sensor se movió de D3 a D5: D3 es GPIO0 y se usa para elegir el
     modo de arranque del ESP8266 — si el reed switch está en estado bajo
     al encender la placa, puede no bootear. D1 y D2 ahora los usa el LCD.
*/

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ---------- CONFIGURACIÓN: completar antes de subir ----------
const char* ssid     = "Estudiantes";
const char* password = "educar_2018";

const char* writeApiKey = "31T55NQVWADY7FFE";   // Write API Key de ThingSpeak (canal 3523746)

const int pinSensor = D5;          // sensor reubicado (D1/D2 ahora son del LCD, ver aviso arriba)
const float mmPorVuelco = 5;       // mm que representa cada vuelco del balancín

const uint8_t lcdDireccion = 0x27; // dirección I2C típica; si no prende/no muestra nada, probar 0x3F
// ---------------------------------------------------------------

const unsigned long intervaloEnvio = 20000;   // ThingSpeak free: mínimo 15 s entre envíos
const unsigned long intervaloLCD   = 1000;    // refresco de pantalla cada 1 s
unsigned long ultimoEnvio = 0;
unsigned long ultimoRefrescoLCD = 0;

volatile int vuelcos = 0;
ESP8266WebServer server(80);
LiquidCrystal_I2C lcd(lcdDireccion, 16, 2);

// Se ejecuta cada vez que el balancín vuelca y activa el sensor reed
void IRAM_ATTR contarVuelco() {
  vuelcos++;
}

// --- Servidor local (para probar en el aula) ---
void handleData() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  float mmAcumulados = vuelcos * mmPorVuelco;
  String json = "{\"mm\":" + String(mmAcumulados, 2) +
                ",\"vuelcos\":" + String(vuelcos) +
                ",\"uptime_ms\":" + String(millis()) + "}";
  server.send(200, "application/json", json);
}

void handleRoot() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String html = "<h2>Pluviometro Digital</h2><p>Vuelcos: " + String(vuelcos) +
                "</p><p>mm acumulados: " + String(vuelcos * mmPorVuelco, 2) +
                "</p><p>Endpoint de datos local: <a href='/data'>/data</a></p>";
  server.send(200, "text/html", html);
}

// --- Envío a ThingSpeak (para que funcione por internet, no solo en el aula) ---
void enviarDatoAThingSpeak() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;
  float mm = vuelcos * mmPorVuelco;

  String url = "http://api.thingspeak.com/update?api_key=" + String(writeApiKey) +
               "&field1=" + String(mm, 2);

  http.begin(client, url);
  int httpCode = http.GET();

  Serial.print("mm acumulados: ");
  Serial.print(mm, 2);
  Serial.print("  |  Envío a ThingSpeak, código: ");
  Serial.println(httpCode);   // 200 = ok. Si da 0 o negativo: revisar WiFi o la Write API Key

  http.end();
}

// --- Pantalla LCD ---
void actualizarLCD() {
  float mm = vuelcos * mmPorVuelco;

  lcd.setCursor(0, 0);
  lcd.print("Lluvia: ");
  lcd.print(mm, 1);
  lcd.print("mm  ");   // espacios extra para pisar dígitos viejos más largos

  lcd.setCursor(0, 1);
  if (WiFi.status() == WL_CONNECTED) {
    lcd.print("WiFi OK  IP:");
    lcd.print(WiFi.localIP()[3]);  // último octeto, para identificar el equipo rápido
    lcd.print("   ");
  } else {
    lcd.print("Sin WiFi...     ");
  }
}

void setup() {
  Serial.begin(9600);
  delay(200);

  pinMode(pinSensor, INPUT);
  attachInterrupt(digitalPinToInterrupt(pinSensor), contarVuelco, RISING);

  Wire.begin(D2, D1);   // SDA = D2, SCL = D1
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Pluviometro");
  lcd.setCursor(0, 1);
  lcd.print("Conectando WiFi");

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
  Serial.print("IP local (para probar /data en el aula): ");
  Serial.println(WiFi.localIP());

  server.on("/", handleRoot);
  server.on("/data", handleData);
  server.begin();
  Serial.println("Servidor local iniciado. Enviando también a ThingSpeak...");

  lcd.clear();
}

void loop() {
  server.handleClient();

  if (millis() - ultimoEnvio > intervaloEnvio) {
    enviarDatoAThingSpeak();
    ultimoEnvio = millis();
  }

  if (millis() - ultimoRefrescoLCD > intervaloLCD) {
    actualizarLCD();
    ultimoRefrescoLCD = millis();
  }
}
