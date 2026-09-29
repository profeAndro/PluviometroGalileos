/*
  ============================================================
   TABLERO DE LLUVIA (lado del navegador)
  ============================================================
  Este archivo corre en el celular o la compu de quien mira la
  página. Se conecta al servidor con "sockets" (una conexión que
  se queda abierta) y, cada vez que llega un dato nuevo del
  Arduino, actualiza el número grande, la gráfica y la lista.

  La clase TableroLluvia agrupa todo el comportamiento de la
  pantalla, como si fuera "el encargado de la pantalla":
  sabe dónde están los elementos y cómo actualizarlos.
  ============================================================
*/

class TableroLluvia {
  constructor() {
    // Guardamos referencias a los elementos de la página
    this.elMmAcumulado = document.getElementById("mmAcumulado");
    this.elUltimaActualizacion = document.getElementById("ultimaActualizacion");
    this.elPuntoEstado = document.getElementById("puntoEstado");
    this.elTextoEstado = document.getElementById("textoEstado");
    this.elListaRegistro = document.getElementById("listaRegistro");
    this.canvasGrafica = document.getElementById("grafica");

    this.historial = []; // lecturas que vamos acumulando en el navegador

    this.conectarAlServidor();
  }

  /** Abre la conexión en vivo con el servidor */
  conectarAlServidor() {
    this.socket = io();

    // El servidor nos envía todo lo que ya tenía guardado, apenas nos conectamos
    this.socket.on("estado_inicial", (estado) => {
      this.marcarEstadoConexion(estado.conectado ? "conectado" : "espera");
      this.historial = estado.historial || [];
      this.actualizarNumeroGrande(estado.mmAcumuladoHoy);
      this.redibujarTodo();
    });

    // Cada vez que hay una lectura nueva del pluviómetro
    this.socket.on("nueva_lectura", (lectura) => {
      this.marcarEstadoConexion("conectado");
      this.historial.push(lectura);
      this.actualizarNumeroGrande(lectura.mmAcumulado);
      this.agregarFilaRegistro(lectura);
      this.dibujarGrafica();
    });

    // Si se corta la conexión con el servidor (no con el Arduino)
    this.socket.on("disconnect", () => {
      this.marcarEstadoConexion("error");
    });
  }

  /** Cambia el puntito y el texto de "conectado / esperando / error" */
  marcarEstadoConexion(estado) {
    const clases = { conectado: "punto--conectado", espera: "punto--espera", error: "punto--error" };
    const textos = {
      conectado: "En vivo",
      espera: "Esperando al Arduino...",
      error: "Sin conexión",
    };

    this.elPuntoEstado.className = "punto " + (clases[estado] || "punto--espera");
    this.elTextoEstado.textContent = textos[estado] || "Conectando...";
  }

  /** Actualiza el número grande de milímetros acumulados */
  actualizarNumeroGrande(mm) {
    this.elMmAcumulado.textContent = (mm ?? 0).toFixed(1);
    this.elUltimaActualizacion.textContent =
      "Última lectura: " + new Date().toLocaleTimeString();
  }

  /** Agrega una línea nueva arriba de la lista de registro */
  agregarFilaRegistro(lectura) {
    // Si la lista dice "no hay lecturas", la limpiamos primero
    if (this.elListaRegistro.querySelector(".registro__vacio")) {
      this.elListaRegistro.innerHTML = "";
    }

    const fila = document.createElement("li");
    fila.className = "registro__nuevo";

    const hora = new Date(lectura.hora).toLocaleTimeString();
    fila.innerHTML = `<span>${hora}</span><span>+${lectura.mmIntervalo.toFixed(2)} mm</span>`;

    this.elListaRegistro.prepend(fila);

    // Quitamos el resaltado "nuevo" de las filas viejas para que solo la última brille
    [...this.elListaRegistro.children].slice(1).forEach((el) => {
      el.classList.remove("registro__nuevo");
    });

    // No dejamos crecer la lista para siempre en la pantalla
    while (this.elListaRegistro.children.length > 12) {
      this.elListaRegistro.removeChild(this.elListaRegistro.lastChild);
    }
  }

  /** Vuelve a construir la lista y la gráfica desde cero (al cargar la página) */
  redibujarTodo() {
    this.elListaRegistro.innerHTML = "";
    if (this.historial.length === 0) {
      this.elListaRegistro.innerHTML = '<li class="registro__vacio">Todavía no hay lecturas registradas</li>';
    } else {
      // Mostramos las últimas primero
      [...this.historial].reverse().slice(0, 12).forEach((lectura) => {
        const fila = document.createElement("li");
        const hora = new Date(lectura.hora).toLocaleTimeString();
        fila.innerHTML = `<span>${hora}</span><span>+${lectura.mmIntervalo.toFixed(2)} mm</span>`;
        this.elListaRegistro.appendChild(fila);
      });
    }
    this.dibujarGrafica();
  }

  /** Dibuja una gráfica de barras simple con las últimas lecturas */
  dibujarGrafica() {
    const ctx = this.canvasGrafica.getContext("2d");
    const ancho = this.canvasGrafica.clientWidth;
    const alto = this.canvasGrafica.height;

    // Ajustamos la resolución interna del canvas a su tamaño real en pantalla
    this.canvasGrafica.width = ancho;

    ctx.clearRect(0, 0, ancho, alto);

    const datos = this.historial.slice(-20); // últimas 20 lecturas
    if (datos.length === 0) return;

    const valorMax = Math.max(...datos.map((d) => d.mmIntervalo), 1);
    const anchoBarra = ancho / datos.length;

    datos.forEach((lectura, i) => {
      const alturaBarra = (lectura.mmIntervalo / valorMax) * (alto - 10);
      const x = i * anchoBarra;
      const y = alto - alturaBarra;

      ctx.fillStyle = lectura.mmIntervalo > 0 ? "#5fa8d3" : "#263349";
      ctx.fillRect(x + 2, y, anchoBarra - 4, alturaBarra);
    });
  }
}

// Cuando la página termina de cargar, arrancamos el tablero
document.addEventListener("DOMContentLoaded", () => {
  new TableroLluvia();
});
