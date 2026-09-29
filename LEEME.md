# Estación de lluvia con Arduino

Esta app muestra, en tiempo real, lo que va midiendo tu pluviómetro conectado a Arduino. La puedes ver desde el celular o la compu, siempre que estén en la misma red wifi que la computadora conectada al Arduino.

## Cómo está armado (en simple)

```
[ Pluviómetro ] --cable--> [ Arduino ] --USB--> [ Servidor Node.js ] --wifi--> [ Celular / Compu ]
```

1. **`arduino/pluviometro.ino`** — se sube al Arduino. Cuenta los "tips" del pluviómetro y los convierte en milímetros de lluvia.
2. **`server.js`** — corre en tu computadora. Lee lo que manda el Arduino por USB y se lo pasa a la página web en vivo.
3. **`public/`** — es la página que ves en el navegador: número grande de lluvia acumulada, gráfica y registro.

## Paso 1: Sube el código al Arduino

1. Abre `arduino/pluviometro.ino` en el programa Arduino IDE.
2. Conecta el cable de señal del pluviómetro al **pin 2**, y el de tierra a **GND**.
3. Si tu pluviómetro no es de 0.2794 mm por "tip", cambia el número en la línea `MM_POR_PULSO` (viene en el manual del sensor).
4. Sube el programa al Arduino (botón de flecha).
5. Deja el Arduino conectado por USB a tu computadora.

## Paso 2: Prepara el servidor

Necesitas tener [Node.js](https://nodejs.org) instalado. Luego, en esta carpeta:

```bash
npm install
```

Después, revisa en qué puerto quedó tu Arduino:
- **Windows**: se ve en el Administrador de dispositivos, algo como `COM3`
- **Mac/Linux**: normalmente `/dev/ttyUSB0` o `/dev/ttyACM0`

Edita esa línea en `server.js` (variable `NOMBRE_PUERTO`) o arráncalo así:

```bash
# Mac/Linux
PUERTO_ARDUINO=/dev/ttyUSB0 npm start

# Windows (PowerShell)
$env:PUERTO_ARDUINO="COM3"; npm start
```

Si todo va bien, verás en la consola:
```
✅ Conectado al Arduino en /dev/ttyACM0
🌧️  Tablero de lluvia disponible en http://localhost:3000
```

## Paso 3: Ábrelo en tu celular o compu

- **En la misma compu del Arduino:** abre `http://localhost:3000`
- **Desde el celular (misma wifi):** necesitas la IP local de la compu.
  - Windows: `ipconfig` (busca "Dirección IPv4")
  - Mac/Linux: `ifconfig` o `ip a` (busca algo como `192.168.1.XX`)
  - En el celular, abre en el navegador: `http://192.168.1.XX:3000`

## Si algo no funciona

- **"No se pudo conectar al Arduino"**: revisa que el puerto (`NOMBRE_PUERTO`) sea el correcto y que ningún otro programa (como el Monitor Serie del Arduino IDE) esté usando ese puerto al mismo tiempo.
- **La página dice "Esperando al Arduino..."**: es normal mientras el servidor intenta conectarse; reintenta solo cada 5 segundos.
- **No carga desde el celular**: confirma que ambos dispositivos estén en la misma red wifi, y que el firewall de tu compu no esté bloqueando el puerto 3000.
