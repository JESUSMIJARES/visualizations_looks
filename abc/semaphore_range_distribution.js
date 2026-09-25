looker.plugins.visualizations.add({
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
          background-color: #f3f4f6;
        }
        .progress-segment {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 700;
          font-size: 13px;
          transition: width 0.3s ease;
          min-width: 24px;
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

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    // 1. Obtener todas las medidas seleccionadas en el Explore
    const measures = queryResponse.fields.measures;

    if (!measures || measures.length === 0 || !data || data.length === 0) {
      this.addError({
        title: "Sin datos",
        message: "Por favor selecciona al menos una medida en tu consulta."
      });
      return;
    }

    // Encabezados dinámicos
    element.querySelector("#title").textContent = config.titleText || "Porcentaje por Rango RPM";
    element.querySelector("#subtitle").textContent = config.subtitleText || "";

    // Colores por defecto para las 3 categorías (Verde, Naranja, Rojo)
    const defaultColors = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];
    const firstRow = data[0];

    // 2. Calcular la suma total de las medidas para obtener porcentajes exactos
    let totalSum = 0;
    measures.forEach(m => {
      const val = parseFloat(firstRow[m.name]?.value) || 0;
      totalSum += val;
    });

    // 3. Procesar los datos de cada columna
    const processedItems = measures.map((m, index) => {
      const rawVal = parseFloat(firstRow[m.name]?.value) || 0;
      
      // Si los datos son decimales (ej: 0.2211), calcular % sobre el total relativo
      const percentVal = totalSum > 0 ? (rawVal / totalSum) * 100 : 0;
      const formattedPercent = `${percentVal.toFixed(1)}%`;

      return {
        label: m.label_short || m.label || m.name,
        rawValue: rawVal,
        percentage: percentVal,
        rendered: formattedPercent,
        color: defaultColors[index % defaultColors.length]
      };
    });

    // 4. Dibujar la barra de progreso
    const progressBar = element.querySelector("#progress-bar");
    progressBar.innerHTML = "";

    processedItems.forEach(item => {
      if (item.percentage > 0) {
        const segment = document.createElement("div");
        segment.className = "progress-segment";
        segment.style.width = `${item.percentage}%`;
        segment.style.backgroundColor = item.color;
        segment.textContent = item.rendered;
        progressBar.appendChild(segment);
      }
    });

    // 5. Dibujar las tarjetas inferiores
    const cardsGrid = element.querySelector("#cards-grid");
    cardsGrid.innerHTML = "";

    processedItems.forEach(item => {
      const card = document.createElement("div");
      card.className = "legend-card";
      card.style.borderColor = item.color;

      card.innerHTML = `
        <div class="card-header">
          <span class="dot" style="background-color: ${item.color};"></span>
          <span class="card-title">${item.label}</span>
        </div>
        <p class="card-desc">${item.label} (${item.rendered})</p>
      `;
      cardsGrid.appendChild(card);
    });

    done();
  }
});