looker.plugins.visualizations.add({
  // 1. OPCIONES DE CONFIGURACIÓN Y SEGURIDAD
  options: {
    titleText: {
      type: "string",
      label: "Título del Gráfico",
      default: "Comparativa Mensual de Conducción Óptima vs. Promedio Daño",
      section: "Texto",
      order: 1
    },
    subtitleText: {
      type: "string",
      label: "Subtítulo",
      default: "Escalas independientes calibradas: Conducción Óptima (0-100%) vs Promedio Daño Motor (0-25 pts)",
      section: "Texto",
      order: 2
    },
    agentApiUrl: {
      type: "string",
      label: "URL Endpoint de tu Backend IA",
      default: "https://tu-backend.com/api/v1/chat",
      section: "Asistente IA (Seguridad)",
      order: 1
    },
    agentApiKey: {
      type: "string",
      label: "API Key / Bearer Token",
      default: "", // Se deja vacío para ingresar privadamente en Looker
      section: "Asistente IA (Seguridad)",
      order: 2
    },
    leftAxisSuffix: {
      type: "string",
      label: "Sufijo Eje Izquierdo",
      default: "%",
      section: "Ejes",
      order: 1
    },
    rightAxisSuffix: {
      type: "string",
      label: "Sufijo Eje Derecho",
      default: " pts",
      section: "Ejes",
      order: 2
    },
    leftColor: {
      type: "string",
      label: "Color Serie 1 (Izquierda)",
      default: "#0f4c81",
      section: "Colores",
      order: 1
    },
    rightColor: {
      type: "string",
      label: "Color Serie 2 (Derecha)",
      default: "#e63946",
      section: "Colores",
      order: 2
    }
  },

  // 2. ESTRUCTURA HTML Y CSS (INCLUYE BOTÓN Y CHAT MOSTRABLE)
  create: function(element, config) {
    element.innerHTML = `
      <style>
        .custom-chart-container {
          position: relative;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          padding: 16px;
          background: #ffffff;
          border-radius: 8px;
          box-sizing: border-box;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }
        .header-text h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #1a1a1a;
        }
        .header-text p {
          margin: 4px 0 0 0;
          font-size: 13px;
          color: #666666;
        }
        .ai-chat-btn {
          background: #0f4c81;
          color: #ffffff;
          border: none;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.15);
          transition: background 0.2s ease;
        }
        .ai-chat-btn:hover {
          background: #0a355c;
        }
        .canvas-wrapper {
          flex: 1;
          position: relative;
          width: 100%;
          min-height: 250px;
        }

        /* Modal/Drawer de Chat Interactivo */
        .chat-drawer {
          display: none;
          position: absolute;
          bottom: 16px;
          right: 16px;
          width: 330px;
          height: 380px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          flex-direction: column;
          overflow: hidden;
        }
        .chat-drawer-header {
          background: #f8fafc;
          padding: 10px 14px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 700;
          font-size: 13px;
          color: #1e293b;
        }
        .chat-close-btn {
          cursor: pointer;
          border: none;
          background: none;
          font-size: 18px;
          color: #64748b;
        }
        .chat-messages {
          flex: 1;
          padding: 12px;
          overflow-y: auto;
          font-size: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .chat-input-area {
          display: flex;
          padding: 8px;
          border-top: 1px solid #e2e8f0;
          background: #ffffff;
        }
        .chat-input-area input {
          flex: 1;
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
          border-radius: 6px;
          font-size: 12px;
          outline: none;
        }
        .chat-input-area button {
          margin-left: 6px;
          background: #0f4c81;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }
        .msg {
          padding: 8px 12px;
          border-radius: 8px;
          max-width: 85%;
          line-height: 1.4;
        }
        .msg.user {
          background: #e0f2fe;
          color: #0369a1;
          align-self: flex-end;
        }
        .msg.bot {
          background: #f1f5f9;
          color: #334155;
          align-self: flex-start;
        }
      </style>
      <div class="custom-chart-container">
        <div class="chart-header">
          <div class="header-text">
            <h3 id="chart-title"></h3>
            <p id="chart-subtitle"></p>
          </div>
          <button class="ai-chat-btn" id="openChatBtn">
            ✨ Preguntar a IA
          </button>
        </div>
        
        <div class="canvas-wrapper">
          <canvas id="dualAxisCanvas"></canvas>
        </div>

        <!-- Ventana de Chat Integrada -->
        <div class="chat-drawer" id="chatDrawer">
          <div class="chat-drawer-header">
            <span>🤖 Asistente del Look</span>
            <button class="chat-close-btn" id="closeChatBtn">&times;</button>
          </div>
          <div class="chat-messages" id="chatMessages">
            <div class="msg bot">¡Hola! Puedo responder preguntas sobre los datos de este gráfico de doble eje.</div>
          </div>
          <div class="chat-input-area">
            <input type="text" id="chatInput" placeholder="Escribe tu consulta aquí..." />
            <button id="sendBtn">Enviar</button>
          </div>
        </div>
      </div>
    `;

    // Cargar Chart.js si no existe
    if (typeof Chart === "undefined") {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/chart.js";
      document.head.appendChild(script);
    }

    // Toggle de apertura y cierre de la ventana de chat
    const chatDrawer = element.querySelector("#chatDrawer");
    element.querySelector("#openChatBtn").onclick = () => {
      chatDrawer.style.display = chatDrawer.style.display === "flex" ? "none" : "flex";
    };
    element.querySelector("#closeChatBtn").onclick = () => {
      chatDrawer.style.display = "none";
    };
  },

  // 3. ACTUALIZACIÓN DE DATOS, DIBUJO DEL GRÁFICO Y CONSUMO DE API
  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    const dimensions = queryResponse.fields.dimensions;
    const measures = queryResponse.fields.measures;

    if (!dimensions || dimensions.length === 0 || !measures || measures.length < 2) {
      this.addError({
        title: "Campos insuficientes",
        message: "Esta visualización requiere 1 Dimensión (Eje X) y al menos 2 Medidas."
      });
      return;
    }

    element.querySelector("#chart-title").textContent = config.titleText || "";
    element.querySelector("#chart-subtitle").textContent = config.subtitleText || "";

    const dimField = dimensions[0].name;
    const leftMeasField = measures[0].name;
    const rightMeasField = measures[1].name;

    const leftLabel = measures[0].label_short || measures[0].label || "Serie Izquierda";
    const rightLabel = measures[1].label_short || measures[1].label || "Serie Derecha";

    const labels = data.map(row => row[dimField].rendered || row[dimField].value);
    const leftData = data.map(row => {
      const val = parseFloat(row[leftMeasField].value) || 0;
      return val <= 1 && val > 0 ? val * 100 : val;
    });
    const rightData = data.map(row => parseFloat(row[rightMeasField].value) || 0);

    // DIBUJAR CHART.JS
    const renderChart = () => {
      const ctx = element.querySelector("#dualAxisCanvas").getContext("2d");

      if (this.chartInstance) {
        this.chartInstance.destroy();
      }

      const leftColor = config.leftColor || "#0f4c81";
      const rightColor = config.rightColor || "#e63946";
      const leftSuffix = config.leftAxisSuffix !== undefined ? config.leftAxisSuffix : "%";
      const rightSuffix = config.rightAxisSuffix !== undefined ? config.rightAxisSuffix : " pts";

      this.chartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: leftLabel,
              data: leftData,
              borderColor: leftColor,
              backgroundColor: leftColor,
              yAxisID: "yLeft",
              tension: 0.2,
              pointRadius: 5,
              borderWidth: 2.5
            },
            {
              label: rightLabel,
              data: rightData,
              borderColor: rightColor,
              backgroundColor: rightColor,
              yAxisID: "yRight",
              tension: 0.2,
              pointRadius: 5,
              borderWidth: 2.5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}${ctx.datasetIndex === 0 ? leftSuffix : rightSuffix}`
              }
            }
          },
          scales: {
            x: { grid: { display: false } },
            yLeft: {
              type: "linear",
              position: "left",
              ticks: { color: leftColor, callback: (v) => v + leftSuffix }
            },
            yRight: {
              type: "linear",
              position: "right",
              grid: { drawOnChartArea: false },
              ticks: { color: rightColor, callback: (v) => v + rightSuffix }
            }
          }
        }
      });
      done();
    };

    if (typeof Chart !== "undefined") {
      renderChart();
    } else {
      const check = setInterval(() => {
        if (typeof Chart !== "undefined") { clearInterval(check); renderChart(); }
      }, 100);
    }

    // LÓGICA DE ENVÍO DE DATOS A TU BACKEND IA CON TOKEN SEGURO
    const sendBtn = element.querySelector("#sendBtn");
    const chatInput = element.querySelector("#chatInput");
    const chatMessages = element.querySelector("#chatMessages");

    const handleSendMessage = async () => {
      const userQuestion = chatInput.value.trim();
      if (!userQuestion) return;

      chatMessages.innerHTML += `<div class="msg user">${userQuestion}</div>`;
      chatInput.value = "";
      chatMessages.scrollTop = chatMessages.scrollHeight;

      if (!config.agentApiKey) {
        chatMessages.innerHTML += `<div class="msg bot" style="color: #b91c1c;">⚠️ Por favor configura la API Key en el panel 'Style' de Looker.</div>`;
        return;
      }

      // Contexto enviado a la API
      const payload = {
        prompt: userQuestion,
        lookContext: {
          dimensions: labels,
          leftSeries: { name: leftLabel, values: leftData },
          rightSeries: { name: rightLabel, values: rightData }
        }
      };

      try {
        const response = await fetch(config.agentApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.agentApiKey}` // Token seguro
          },
          body: JSON.stringify(payload)
        });

        const resData = await response.json();
        const botReply = resData.reply || "Respuesta recibida correctamente.";
        chatMessages.innerHTML += `<div class="msg bot">${botReply}</div>`;
      } catch (err) {
        chatMessages.innerHTML += `<div class="msg bot" style="color: #b91c1c;">Error al conectar con la API de IA.</div>`;
      }
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    sendBtn.onclick = handleSendMessage;
    chatInput.onkeypress = (e) => { if (e.key === "Enter") handleSendMessage(); };
  }
});