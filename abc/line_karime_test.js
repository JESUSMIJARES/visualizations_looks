looker.plugins.visualizations.add({
  options: {
    chartTitle: {
      type: "string",
      label: "Título del Gráfico",
      default: "Evolución Mensual",
      section: "Texto"
    },
    chartSubtitle: {
      type: "string",
      label: "Subtítulo",
      default: "",
      section: "Texto"
    },
    colorPalette: {
      type: "array",
      label: "Paleta de Colores",
      default: ["#00c379", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#10b981", "#6366f1"],
      section: "Estilo"
    }
  },

  create: function (element, config) {
    element.innerHTML = `
      <style>
        .custom-chart-container {
          width: 100%;
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          padding: 10px;
        }
        .chart-header { margin-bottom: 10px; }
        .chart-title { font-size: 16px; font-weight: bold; color: #111827; margin: 0; }
        .chart-subtitle { font-size: 12px; color: #6b7280; margin: 4px 0 0 0; }
        .chart-canvas { flex: 1; width: 100%; min-height: 250px; }
      </style>
      <div class="custom-chart-container">
        <div class="chart-header">
          <h2 class="chart-title" id="viz-title"></h2>
          <p class="chart-subtitle" id="viz-subtitle"></p>
        </div>
        <div class="chart-canvas" id="echarts-container"></div>
      </div>
    `;

    const container = element.querySelector('#echarts-container');
    this._chart = echarts.init(container);
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    this.clearErrors();

    const dims = queryResponse.fields.dimension_like;
    const measures = queryResponse.fields.measure_like;
    const pivots = queryResponse.pivots;

    if (dims.length === 0) {
      this.addError({
        id: "no-dims",
        title: "Falta Dimensión",
        message: "Selecciona al menos 1 dimensión para el eje X."
      });
      return;
    }

    if (measures.length === 0) {
      this.addError({
        id: "no-measures",
        title: "Faltan Mediciones",
        message: "Selecciona al menos 1 medida (measure)."
      });
      return;
    }

    // Encabezados
    element.querySelector('#viz-title').textContent = config.chartTitle || '';
    element.querySelector('#viz-subtitle').textContent = config.chartSubtitle || '';

    const colors = config.colorPalette || ["#00c379", "#f59e0b", "#3b82f6", "#ef4444"];
    let xAxisData = [];
    let series = [];

    // CASO 1: Datos Pivotados en Looker
    if (pivots && pivots.length > 0) {
      xAxisData = data.map(row => LookerCharts.Utils.htmlForCell(row[dims[0].name]));

      let colorIndex = 0;
      measures.forEach(m => {
        pivots.forEach(p => {
          const pivotLabel = Object.values(p.data).join(' - ');
          const seriesName = measures.length > 1 ? `${m.label_short || m.label} (${pivotLabel})` : pivotLabel;

          series.push({
            name: seriesName,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: { color: colors[colorIndex % colors.length] },
            lineStyle: { width: 2.5 },
            data: data.map(row => {
              const cell = row[m.name] ? row[m.name][p.key] : null;
              return cell ? cell.value : null;
            })
          });
          colorIndex++;
        });
      });

    // CASO 2: 2 Dimensiones sin Pivot (Eje X = Dim 1, Series = Valores de Dim 2)
    } else if (dims.length >= 2) {
      const xDim = dims[0].name;
      const groupDim = dims[1].name;

      xAxisData = [...new Set(data.map(row => LookerCharts.Utils.htmlForCell(row[xDim])))];
      const uniqueGroups = [...new Set(data.map(row => LookerCharts.Utils.htmlForCell(row[groupDim])))];

      let colorIndex = 0;
      measures.forEach(m => {
        uniqueGroups.forEach(groupValue => {
          const seriesName = measures.length > 1 ? `${m.label_short || m.label} - ${groupValue}` : groupValue;

          const seriesData = xAxisData.map(xVal => {
            const foundRow = data.find(row => 
              LookerCharts.Utils.htmlForCell(row[xDim]) === xVal && 
              LookerCharts.Utils.htmlForCell(row[groupDim]) === groupValue
            );
            return foundRow && foundRow[m.name] ? foundRow[m.name].value : null;
          });

          series.push({
            name: seriesName,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: { color: colors[colorIndex % colors.length] },
            lineStyle: { width: 2.5 },
            data: seriesData
          });
          colorIndex++;
        });
      });

    // CASO 3: 1 Dimensión + Múltiples Mediciones
    } else {
      xAxisData = data.map(row => LookerCharts.Utils.htmlForCell(row[dims[0].name]));

      series = measures.map((m, index) => ({
        name: m.label_short || m.label,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: colors[index % colors.length] },
        lineStyle: { width: 2.5 },
        data: data.map(row => row[m.name] ? row[m.name].value : null)
      }));
    }

    // Configuración de ECharts
    const option = {
      tooltip: {
        trigger: 'axis',
        valueFormatter: (val) => val != null ? (typeof val === 'number' ? val.toLocaleString() : val) : '-'
      },
      legend: {
        bottom: 0,
        icon: 'circle',
        itemGap: 15,
        textStyle: { color: '#374151', fontSize: 12 }
      },
      grid: {
        top: '12%',
        left: '3%',
        right: '4%',
        bottom: '18%',
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
            if (Math.abs(value) >= 1000) return '$' + (value / 1000) + 'k';
            return '$' + value;
          }
        }
      },
      series: series
    };

    this._chart.setOption(option, true);
    this._chart.resize();

    done();
  }
});