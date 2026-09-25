looker.plugins.visualizations.add({
  // Opciones de configuración visibles en el panel de Looker
  options: {
    titleText: {
      type: "string",
      label: "Título del Gráfico",
      default: "Porcentaje por Rango RPM",
      section: "Texto"
    },
    subtitleText: {
      type: "string",
      label: "Subtítulo",
      default: "Distribución del tiempo de operación de motor según revoluciones por minuto",
      section: "Texto"
    }
  },

  // Inicialización del contenedor
  create: function(element, config) {
    element.innerHTML = `
      <style>
        .custom-viz-container {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          padding: 16px;
          background: #ffffff;
          border-radius: 8px;
          box-sizing: border-box;
          width: 100%;
        }
        .viz-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #1a1a1a;
        }
        .viz-header p {
          margin: 4px 0 16px 0;
          font-size: 13px;
          color: #666666;
        }
        .progress-bar-container {
          display: flex;
          height: 32px;
          width: 100%;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .progress-segment {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 700;
          font-size: 13px;
          transition: width 0.3s ease;
        }
        .cards-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        .legend-card {
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 12px;
          box-sizing: border-box;
          background: #ffffff;
        }
        .card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
        }
        .card-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .card-desc {
          margin: 0;
          font-size: 12px;
          color: #555555;
        }
      </style>
      <div class="custom-viz-container">
        <div class="viz-header">
          <h3 id="title"></h3>
          <p id="subtitle"></p>
        </div>
        <div class="progress-bar-container" id="progress-bar"></div>
        <div class="cards-container" id="cards-grid"></div>
      </div>
    `;
  },

  // Renderizado dinámico según los datos devueltos por Looker
  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    // 1. Validar que existan dimensiones y medidas esperadas
    if (queryResponse.fields.dimensions.length < 1 || queryResponse.fields.measures.length < 1) {
      this.addError({
        title: "Campos insuficientes",
        message: "Esta visualización requiere al menos 1 dimensión (Categoría/Rango) y 1 medida (Porcentaje o Valor)."
      });
      return;
    }

    // Actualizar encabezados desde opciones
    element.querySelector("#title").textContent = config.titleText || "Porcentaje por Rango RPM";
    element.querySelector("#subtitle").textContent = config.subtitleText || "";

    const dimField = queryResponse.fields.dimensions[0].name;
    const measField = queryResponse.fields.measures[0].name;

    // Colores por defecto asignados según la secuencia o nombres
    const defaultColors = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];

    // 2. Extraer y procesar datos
    let totalValue = 0;
    const rows = data.map((row, index) => {
      const label = row[dimField].value;
      const val = parseFloat(row[measField].value) || 0;
      const renderedVal = row[measField].rendered || `${val}%`;
      totalValue += val;

      return {
        label: label,
        value: val,
        rendered: renderedVal,
        color: defaultColors[index % defaultColors.length]
      };
    });

    // 3. Renderizar Barra de Progreso Segmentada
    const progressBar = element.querySelector("#progress-bar");
    progressBar.innerHTML = "";

    rows.forEach(item => {
      const percentage = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : 0;
      const segment = document.createElement("div");
      segment.className = "progress-segment";
      segment.style.width = `${percentage}%`;
      segment.style.backgroundColor = item.color;
      segment.textContent = `${item.rendered}`;
      progressBar.appendChild(segment);
    });

    // 4. Renderizar Tarjetas de Leyenda en la parte inferior
    const cardsGrid = element.querySelector("#cards-grid");
    cardsGrid.innerHTML = "";

    rows.forEach(item => {
      const card = document.createElement("div");
      card.className = "legend-card";
      card.style.borderColor = item.color;

      card.innerHTML = `
        <div class="card-header">
          <span class="dot" style="background-color: ${item.color};"></span>
          <span class="card-title" style="color: #1a1a1a;">${item.label}</span>
        </div>
        <p class="card-desc">${item.label} (${item.rendered})</p>
      `;
      cardsGrid.appendChild(card);
    });

    done();
  }
});