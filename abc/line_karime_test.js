// Asegúrate de incluir ECharts en tu HTML o cargarlo dinámicamente si estás en un bundle
// <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>

looker.plugins.visualizations.add({
  // Configuración de la interfaz del editor de Looker
  options: {
    chartTitle: {
      type: "string",
      label: "Título del Gráfico",
      default: "Evolución Mensual por Rendimiento",
      section: "Texto"
    },
    chartSubtitle: {
      type: "string",
      label: "Subtítulo",
      default: "Ahorro conseguido vs Gasto adicional por km/L operativo",
      section: "Texto"
    },
    colorPalette: {
      type: "array",
      label: "Colores de las líneas",
      default: ["#00c379", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6"],
      section: "Estilo"
    }
  },

  // Método de inicialización
  create: function (element, config) {
    // Inyectar el contenedor del gráfico y la estructura de títulos
    element.innerHTML = `
      <style>
        .custom-chart-container {
          width: 100%;
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          padding: 10px;
        }
        .chart-header {
          margin-bottom: 10px;
        }
        .chart-title {
          font-size: 16px;
          font-weight: bold;
          color: #111827;
          margin: 0;
        }
        .chart-subtitle {
          font-size: 12px;
          color: #6b7280;
          margin: 4px 0 0 0;
        }
        .chart-canvas {
          flex: 1;
          width: 100%;
          min-height: 250px;
        }
      </style>
      <div class="custom-chart-container">
        <div class="chart-header">
          <h2 class="chart-title" id="viz-title"></h2>
          <p class="chart-subtitle" id="viz-subtitle"></p>
        </div>
        <div class="chart-canvas" id="echarts-container"></div>
      </div>
    `;

    // Inicializar la instancia de ECharts
    const container = element.querySelector('#echarts-container');
    this._chart = echarts.init(container);
  },

  // Método que se ejecuta cada vez que cambian los datos o la configuración
  updateAsync: function (data, element, config, queryResponse, details, done) {
    // Limpiar errores previos
    this.clearErrors();

    // Validar requerimientos de dimensiones y mediciones
    const dims = queryResponse.fields.dimension_like;
    const measures = queryResponse.fields.measure_like;

    if (dims.length > 1) {
      this.addError({
        id: "dim-limit",
        title: "Demasiadas Dimensiones",
        message: "Este visualizador acepta como máximo 1 dimensión en el eje X."
      });
      return;
    }

    if (measures.length === 0) {
      this.addError({
        id: "no-measures",
        title: "Faltan Mediciones",
        message: "Por favor, selecciona al menos 1 medida (measure)."
      });
      return;
    }

    // Actualizar encabezados
    element.querySelector('#viz-title').textContent = config.chartTitle || '';
    element.querySelector('#viz-subtitle').textContent = config.chartSubtitle || '';

    // Extraer valores de la dimensión (Eje X)
    const xAxisData = dims.length > 0 
      ? data.map(row => LookerCharts.Utils.htmlForCell(row[dims[0].name]))
      : data.map((_, i) => `Fila ${i + 1}`);

    // Construir las series de datos para cada medición
    const colors = config.colorPalette || ["#00c379", "#f59e0b"];
    const series = measures.map((m, index) => {
      return {
        name: m.label_short || m.label,
        type: 'line',
        smooth: true, // Curva suave similar a la imagen
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: {
          color: colors[index % colors.length]
        },
        lineStyle: {
          width: 2.5
        },
        data: data.map(row => {
          const cell = row[m.name];
          return cell ? cell.value : null;
        })
      };
    });

    // Configuración completa del gráfico ECharts
    const option = {
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value) => value != null ? '$' + value.toLocaleString() : ''
      },
      legend: {
        bottom: 0,
        icon: 'circle',
        itemGap: 20,
        textStyle: {
          color: '#374151',
          fontSize: 12
        }
      },
      grid: {
        top: '10%',
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xAxisData,
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisLabel: { color: '#4b5563' },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } },
        axisLabel: {
          color: '#9ca3af',
          formatter: (value) => {
            if (value >= 1000) return '$' + (value / 1000) + 'k';
            return '$' + value;
          }
        }
      },
      series: series
    };

    // Renderizar gráfico y ajustar tamaño responsivo
    this._chart.setOption(option, true);
    this._chart.resize();

    done();
  }
});