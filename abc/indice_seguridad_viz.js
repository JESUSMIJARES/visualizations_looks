/**
 * Visualización: Evolución Mensual del Índice de Seguridad
 * Línea suavizada con puntos, eje Y en "pts", meses en español.
 * Requiere ECharts como dependencia en el manifest.
 */
looker.plugins.visualizations.add({
  id: "evolucion_indice_seguridad",
  label: "Evolución Mensual (Línea)",

  options: {
    chartTitle: {
      type: "string",
      label: "Título",
      default: "Evolución Mensual del Índice de Seguridad",
      section: "Texto",
      order: 1
    },
    chartSubtitle: {
      type: "string",
      label: "Subtítulo",
      default: "Tendencia histórica del score consolidado de seguridad vial de la flota",
      section: "Texto",
      order: 2
    },
    unitSuffix: {
      type: "string",
      label: "Sufijo de unidad",
      default: " pts",
      section: "Eje Y",
      order: 1
    },
    yMin: {
      type: "number",
      label: "Mínimo eje Y (vacío = automático)",
      default: 80,
      section: "Eje Y",
      order: 2
    },
    yMax: {
      type: "number",
      label: "Máximo eje Y (vacío = automático)",
      default: 100,
      section: "Eje Y",
      order: 3
    },
    yInterval: {
      type: "number",
      label: "Intervalo eje Y",
      default: 5,
      section: "Eje Y",
      order: 4
    },
    decimals: {
      type: "number",
      label: "Decimales en tooltip",
      default: 1,
      section: "Eje Y",
      order: 5
    },
    colorPalette: {
      type: "array",
      label: "Colores de las series",
      display: "colors",
      default: ["#1f4e9a", "#00c379", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6"],
      section: "Estilo",
      order: 1
    },
    smoothLine: {
      type: "boolean",
      label: "Línea suavizada",
      default: true,
      section: "Estilo",
      order: 2
    },
    showLegend: {
      type: "boolean",
      label: "Mostrar leyenda",
      default: true,
      section: "Estilo",
      order: 3
    },
    showCard: {
      type: "boolean",
      label: "Mostrar como tarjeta (borde y sombra)",
      default: true,
      section: "Estilo",
      order: 4
    }
  },

  create: function (element, config) {
    element.innerHTML = `
      <style>
        .ise-wrap {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          padding: 6px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .ise-card {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          background: #ffffff;
          padding: 18px 20px 12px 20px;
          border-radius: 10px;
        }
        .ise-card.with-border {
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px rgba(17, 24, 39, 0.06);
        }
        .ise-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #111827;
          line-height: 1.3;
        }
        .ise-subtitle {
          margin: 4px 0 0 0;
          font-size: 12px;
          color: #6b7280;
          line-height: 1.4;
        }
        .ise-canvas {
          flex: 1;
          width: 100%;
          min-height: 220px;
          margin-top: 8px;
        }
      </style>
      <div class="ise-wrap">
        <div class="ise-card with-border" id="ise-card">
          <div>
            <h2 class="ise-title" id="ise-title"></h2>
            <p class="ise-subtitle" id="ise-subtitle"></p>
          </div>
          <div class="ise-canvas" id="ise-chart"></div>
        </div>
      </div>
    `;

    const container = element.querySelector("#ise-chart");
    this._chart = echarts.init(container);

    // Ajusta el gráfico cuando cambia el tamaño del tile o del iframe embebido
    this._resizeObserver = new ResizeObserver(() => {
      if (this._chart) this._chart.resize();
    });
    this._resizeObserver.observe(container);
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    this.clearErrors();

    const dims = queryResponse.fields.dimension_like;
    const measures = queryResponse.fields.measure_like;
    const pivots = queryResponse.pivots;

    if (dims.length === 0) {
      this.addError({ id: "no-dims", title: "Falta dimensión", message: "Selecciona una dimensión de fecha (por ejemplo, Mes) para el eje X." });
      done();
      return;
    }
    if (measures.length === 0) {
      this.addError({ id: "no-measures", title: "Falta medida", message: "Selecciona al menos una medida (por ejemplo, Índice de Seguridad)." });
      done();
      return;
    }

    // ---------- Encabezado ----------
    element.querySelector("#ise-title").textContent = config.chartTitle || "";
    element.querySelector("#ise-subtitle").textContent = config.chartSubtitle || "";
    element.querySelector("#ise-card").classList.toggle("with-border", config.showCard !== false);

    // ---------- Utilidades ----------
    const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const colors = (config.colorPalette && config.colorPalette.length) ? config.colorPalette : ["#1f4e9a"];
    const suffix = config.unitSuffix != null ? config.unitSuffix : " pts";
    const decimals = Number.isFinite(config.decimals) ? config.decimals : 1;
    const xDim = dims[0].name;

    // Si los datos abarcan más de un año, agrega el año a la etiqueta (Ene 25, Ene 26)
    const years = new Set(
      data.map(r => String(r[xDim].value || "").slice(0, 4)).filter(y => /^\d{4}$/.test(y))
    );
    const multiYear = years.size > 1;

    const xLabel = (row) => {
      const cell = row[xDim];
      const raw = String(cell.value || "");
      const m = raw.match(/^(\d{4})-(\d{2})/); // "2026-01" o "2026-01-15"
      if (m) {
        const mes = MESES[parseInt(m[2], 10) - 1];
        return multiYear ? `${mes} ${m[1].slice(2)}` : mes;
      }
      return LookerCharts.Utils.textForCell(cell);
    };

    const fmt = (v) => (v == null || isNaN(v))
      ? "-"
      : Number(v).toLocaleString("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;

    const buildSeries = (name, values, idx) => ({
      name,
      type: "line",
      smooth: config.smoothLine !== false ? 0.35 : false,
      symbol: "circle",
      symbolSize: 9,
      showSymbol: true,
      connectNulls: true,
      itemStyle: { color: colors[idx % colors.length], borderColor: colors[idx % colors.length], borderWidth: 1 },
      lineStyle: { width: 3, color: colors[idx % colors.length] },
      emphasis: { focus: "series", scale: 1.4 },
      data: values
    });

    // ---------- Construcción de series ----------
    const xAxisData = data.map(xLabel);
    let series = [];

    if (pivots && pivots.length > 0) {
      let i = 0;
      measures.forEach(m => {
        pivots.forEach(p => {
          const pivotLabel = Object.values(p.data).join(" - ");
          const name = measures.length > 1 ? `${m.label_short || m.label} (${pivotLabel})` : pivotLabel;
          const values = data.map(row => {
            const cell = row[m.name] && row[m.name][p.key];
            return cell && cell.value != null ? cell.value : null;
          });
          series.push(buildSeries(name, values, i++));
        });
      });
    } else {
      series = measures.map((m, i) =>
        buildSeries(
          m.label_short || m.label,
          data.map(row => (row[m.name] && row[m.name].value != null) ? row[m.name].value : null),
          i
        )
      );
    }

    // ---------- Eje Y ----------
    const hasNum = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
    const yAxis = {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { type: [4, 4], color: "#eef0f3" } },
      axisLabel: {
        color: "#6b7280",
        fontSize: 12,
        formatter: (v) => `${v}${suffix}`
      }
    };
    if (hasNum(config.yMin)) yAxis.min = Number(config.yMin);
    if (hasNum(config.yMax)) yAxis.max = Number(config.yMax);
    if (hasNum(config.yInterval) && Number(config.yInterval) > 0) yAxis.interval = Number(config.yInterval);

    // ---------- Opciones de ECharts ----------
    const showLegend = config.showLegend !== false;
    const option = {
      textStyle: { fontFamily: '"Inter", -apple-system, "Segoe UI", Roboto, sans-serif' },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#ffffff",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: "#111827", fontSize: 12 },
        extraCssText: "box-shadow: 0 4px 12px rgba(17,24,39,0.10); border-radius: 8px;",
        axisPointer: { type: "line", lineStyle: { color: "#cbd5e1", type: "dashed" } },
        valueFormatter: fmt
      },
      legend: {
        show: showLegend,
        bottom: 0,
        icon: "circle",
        itemWidth: 14,
        itemHeight: 14,
        itemGap: 20,
        textStyle: { color: "#374151", fontSize: 12 }
      },
      grid: {
        top: 16,
        left: 8,
        right: 16,
        bottom: showLegend ? 44 : 12,
        containLabel: true
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: xAxisData,
        axisLine: { lineStyle: { color: "#e5e7eb" } },
        axisTick: { show: false },
        axisLabel: { color: "#4b5563", fontSize: 12, fontWeight: 600, margin: 12 }
      },
      yAxis,
      series
    };

    this._chart.setOption(option, true);
    this._chart.resize();
    done();
  }
});
