looker.plugins.visualizations.add({
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

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .custom-chart-container {
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
        .chart-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #1a1a1a;
        }
        .chart-header p {
          margin: 4px 0 16px 0;
          font-size: 13px;
          color: #666666;
        }
        .canvas-wrapper {
          flex: 1;
          position: relative;
          width: 100%;
          min-height: 250px;
        }
      </style>
      <div class="custom-chart-container">
        <div class="chart-header">
          <h3 id="chart-title"></h3>
          <p id="chart-subtitle"></p>
        </div>
        <div class="canvas-wrapper">
          <canvas id="dualAxisCanvas"></canvas>
        </div>
      </div>
    `;

    // Cargar Chart.js dinámicamente si no está presente
    if (typeof Chart === "undefined") {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/chart.js";
      document.head.appendChild(script);
    }
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    // 1. Validar que tengamos al menos 1 dimensión (Mes/Fecha) y 2 medidas
    const dimensions = queryResponse.fields.dimensions;
    const measures = queryResponse.fields.measures;

    if (!dimensions || dimensions.length === 0 || !measures || measures.length < 2) {
      this.addError({
        title: "Campos insuficientes",
        message: "Esta visualización requiere 1 Dimensión (Eje X: p.ej. Mes) y al menos 2 Medidas (Serie Izquierda y Serie Derecha)."
      });
      return;
    }

    // Actualizar encabezados
    element.querySelector("#chart-title").textContent = config.titleText || "";
    element.querySelector("#chart-subtitle").textContent = config.subtitleText || "";

    const dimField = dimensions[0].name;
    const leftMeasField = measures[0].name;
    const rightMeasField = measures[1].name;

    const leftLabel = measures[0].label_short || measures[0].label || "Serie Izquierda";
    const rightLabel = measures[1].label_short || measures[1].label || "Serie Derecha";

    // Extraer etiquetas del Eje X y datos de las series
    const labels = data.map(row => row[dimField].rendered || row[dimField].value);
    const leftData = data.map(row => {
      const val = parseFloat(row[leftMeasField].value) || 0;
      // Convertir decimales a porcentaje si el valor es <= 1
      return val <= 1 && val > 0 ? val * 100 : val;
    });
    const rightData = data.map(row => parseFloat(row[rightMeasField].value) || 0);

    // Esperar a que Chart.js esté cargado en la página
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
              pointHoverRadius: 7,
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
              pointHoverRadius: 7,
              borderWidth: 2.5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                usePointStyle: true,
                boxWidth: 8,
                font: { size: 12, weight: "bold" },
                padding: 20
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const suffix = context.datasetIndex === 0 ? leftSuffix : rightSuffix;
                  return `${context.dataset.label}: ${context.raw.toFixed(1)}${suffix}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 12, weight: "600" }, color: "#666" }
            },
            yLeft: {
              type: "linear",
              display: true,
              position: "left",
              grid: { color: "#f0f0f0" },
              ticks: {
                color: leftColor,
                font: { weight: "bold" },
                callback: function(value) {
                  return value + leftSuffix;
                }
              }
            },
            yRight: {
              type: "linear",
              display: true,
              position: "right",
              grid: { drawOnChartArea: false },
              ticks: {
                color: rightColor,
                font: { weight: "bold" },
                callback: function(value) {
                  return value + rightSuffix;
                }
              }
            }
          }
        }
      });

      done();
    };

    if (typeof Chart !== "undefined") {
      renderChart();
    } else {
      const checkChart = setInterval(() => {
        if (typeof Chart !== "undefined") {
          clearInterval(checkChart);
          renderChart();
        }
      }, 100);
    }
  }
});