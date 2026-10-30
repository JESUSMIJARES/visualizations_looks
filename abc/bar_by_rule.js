/**
 * Visualización: Calificación Desglosada por Regla
 * Barras verticales, una por regla. Eje Y en "pts" (0-100).
 *
 * Formas de alimentarla:
 *  A) Sin dimensión, varias medidas (una por regla)  -> cada medida es una barra.
 *     El nombre de la barra es el label de la medida en LookML.
 *  B) 1 dimensión (ej. Regla) + 1 medida              -> cada fila es una barra.
 *
 * Carga ECharts por su cuenta si no viene como dependencia.
 */
looker.plugins.visualizations.add({
    id: "calificacion_por_regla",
    label: "Barras por Regla",

    options: {
        chartTitle: {
            type: "string",
            label: "Título",
            default: "Calificación Desglosada por Regla",
            section: "Texto",
            order: 1
        },
        chartSubtitle: {
            type: "string",
            label: "Subtítulo",
            default: "Puntuación sobre 100 pts por regla telemática y dinámica vehicular",
            section: "Texto",
            order: 2
        },
        showFootnote: {
            type: "boolean",
            label: "Mostrar nota de reglas evaluadas",
            default: true,
            section: "Texto",
            order: 3
        },
        footnoteCustom: {
            type: "string",
            label: "Texto de la nota (vacío = lista automática)",
            default: "",
            section: "Texto",
            order: 4
        },
        seriesName: {
            type: "string",
            label: "Nombre en la leyenda",
            default: "Calificación",
            section: "Texto",
            order: 5
        },
        nullLabel: {
            type: "string",
            label: "Etiqueta para valores vacíos",
            default: "Sin asignar",
            section: "Texto",
            order: 6
        },
        headerNote: {
            type: "string",
            label: "Nota a la derecha del título (ej. por mes)",
            default: "",
            section: "Texto",
            order: 7
        },
        monthLabels: {
            type: "boolean",
            label: "Mostrar meses como Ene, Feb… (ordenados)",
            default: false,
            section: "Estilo",
            order: 3.5
        },
        legendTop: {
            type: "boolean",
            label: "Leyenda arriba a la izquierda",
            default: false,
            section: "Estilo",
            order: 4.5
        },
        moneyFormat: {
            type: "boolean",
            label: "Valores en moneda ($500 mil / $1.5 M)",
            default: false,
            section: "Eje Y",
            order: 0
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
            label: "Mínimo eje Y",
            default: 0,
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
            default: 25,
            section: "Eje Y",
            order: 4
        },
        decimals: {
            type: "number",
            label: "Decimales en tooltip y etiquetas",
            default: 1,
            section: "Eje Y",
            order: 5
        },
        barColor: {
            type: "array",
            label: "Color de las barras (serie 1)",
            display: "color",
            default: ["#12468a"],
            section: "Estilo",
            order: 1
        },
        extraColors: {
            type: "array",
            label: "Colores series 2, 3… (con varias medidas)",
            display: "colors",
            default: ["#f39c12", "#10b981", "#ef4444", "#8b5cf6"],
            section: "Estilo",
            order: 1.5
        },
        showValues: {
            type: "boolean",
            label: "Mostrar valor sobre cada barra",
            default: false,
            section: "Estilo",
            order: 2
        },
        sortBars: {
            type: "string",
            label: "Orden de las barras",
            display: "select",
            values: [
                { "Como vienen en el Explore": "none" },
                { "Mayor a menor": "desc" },
                { "Menor a mayor": "asc" }
            ],
            default: "none",
            section: "Estilo",
            order: 3
        },
        showLegend: {
            type: "boolean",
            label: "Mostrar leyenda",
            default: true,
            section: "Estilo",
            order: 4
        },
        showCard: {
            type: "boolean",
            label: "Mostrar como tarjeta (borde y sombra)",
            default: true,
            section: "Estilo",
            order: 5
        }
    },

    create: function (element, config) {
        element.innerHTML = `
      <style>
        .cpr-wrap {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          padding: 6px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .cpr-card {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          background: #ffffff;
          padding: 18px 20px 12px 20px;
          border-radius: 10px;
        }
        .cpr-card.with-border {
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px rgba(17, 24, 39, 0.06);
        }
        .cpr-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #111827;
          line-height: 1.3;
        }
        .cpr-subtitle {
          margin: 4px 0 0 0;
          font-size: 12px;
          color: #6b7280;
          line-height: 1.4;
        }
        .cpr-canvas {
          flex: 1;
          width: 100%;
          min-height: 220px;
          margin-top: 8px;
        }
        .cpr-msg {
          display: none;
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 6px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          font-size: 12px;
        }
      </style>
      <div class="cpr-wrap">
        <div class="cpr-card with-border" id="cpr-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div>
              <h2 class="cpr-title" id="cpr-title"></h2>
              <p class="cpr-subtitle" id="cpr-subtitle"></p>
            </div>
            <span id="cpr-note" style="font-size:12px;color:#6b7280;white-space:nowrap;"></span>
          </div>
          <div class="cpr-msg" id="cpr-msg"></div>
          <div class="cpr-canvas" id="cpr-chart"></div>
        </div>
      </div>
    `;

        const container = element.querySelector("#cpr-chart");
        this._resizeObserver = new ResizeObserver(() => {
            if (!this._chart) return;
            this._chart.resize();
            // Recalcula el ancho de las etiquetas del eje X con el nuevo tamaño
            if (this._lastArgs) {
                clearTimeout(this._resizeTimer);
                this._resizeTimer = setTimeout(() => this.updateAsync(...this._lastArgs, () => { }), 150);
            }
        });
        this._resizeObserver.observe(container);
    },

    // Carga ECharts por su cuenta si no vino como dependencia
    _loadECharts: function () {
        if (typeof echarts !== "undefined") return Promise.resolve();
        if (this._echartsPromise) return this._echartsPromise;
        this._echartsPromise = new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.0/echarts.min.js";
            s.onload = () => resolve();
            s.onerror = () => { this._echartsPromise = null; reject(new Error("No se pudo descargar ECharts")); };
            document.head.appendChild(s);
        });
        return this._echartsPromise;
    },

    _ensureChart: function (element) {
        const msg = element.querySelector("#cpr-msg");
        if (typeof echarts === "undefined") {
            msg.style.display = "block";
            msg.textContent = "No se pudo cargar ECharts. Revisa la consola (F12) o la conexión a cdnjs.cloudflare.com.";
            return false;
        }
        msg.style.display = "none";
        if (!this._chart) {
            this._chart = echarts.init(element.querySelector("#cpr-chart"));
        }
        return true;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
        this.clearErrors();

        const dims = queryResponse.fields.dimension_like;
        const measures = queryResponse.fields.measure_like;

        if (measures.length === 0) {
            this.addError({ id: "no-measures", title: "Falta medida", message: "Agrega las medidas de calificación de cada regla (Aceleración, Frenado, Giros...)." });
            done();
            return;
        }
        if (!data || data.length === 0) {
            this.addError({ id: "no-data", title: "Sin datos", message: "La consulta no regresó resultados." });
            done();
            return;
        }

        // ---------- Encabezado ----------
        element.querySelector("#cpr-title").textContent = config.chartTitle || "";
        element.querySelector("#cpr-subtitle").textContent = config.chartSubtitle || "";
        element.querySelector("#cpr-note").textContent = config.headerNote || "";
        element.querySelector("#cpr-card").classList.toggle("with-border", config.showCard !== false);

        if (typeof echarts === "undefined") {
            this._loadECharts()
                .then(() => this.updateAsync(data, element, config, queryResponse, details, done))
                .catch(() => { this._ensureChart(element); done(); });
            return;
        }
        if (!this._ensureChart(element)) {
            done();
            return;
        }

        this._lastArgs = [data, element, config, queryResponse, details];

        // ---------- Construir barras (categoría, valor) ----------
        const toNum = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? null : Number(v);
        let bars = [];
        let seriesNames = [];

        if (dims.length === 0) {
            // A) Cada medida es una barra (una sola serie); se toma la primera fila
            const row = data[0];
            bars = measures.map(m => {
                const v = toNum(row[m.name] && row[m.name].value);
                return { name: m.label_short || m.label, value: v, values: [v] };
            });
            seriesNames = [config.seriesName || "Calificación"];
        } else {
            // B) Cada fila es un grupo; cada medida es una serie (barras agrupadas)
            const d0 = dims[0].name;
            const nullLabel = (config.nullLabel && config.nullLabel.trim()) || "Sin asignar";
            bars = data.map(row => {
                const cell = row[d0];
                const isNull = !cell || cell.value === null || cell.value === undefined || cell.value === "";
                const values = measures.map(m => toNum(row[m.name] && row[m.name].value));
                return {
                    name: isNull ? nullLabel : LookerCharts.Utils.textForCell(cell),
                    value: values[0],
                    values
                };
            });
            seriesNames = measures.length === 1
                ? [config.seriesName || measures[0].label_short || measures[0].label]
                : measures.map(m => m.label_short || m.label);
        }

        // Opcional: si las barras son meses (2026-06), mostrarlas como "Jun" y en orden cronológico
        if (config.monthLabels === true && bars.length && bars.every(b => /^\d{4}-\d{2}$/.test(String(b.name)))) {
            const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
            const multiYear = new Set(bars.map(b => String(b.name).slice(0, 4))).size > 1;
            bars.sort((a, b) => String(a.name).localeCompare(String(b.name)));
            bars.forEach(b => {
                const [y, m] = String(b.name).split("-");
                b.name = MESES[parseInt(m, 10) - 1] + (multiYear ? " " + y.slice(2) : "");
            });
        }

        if (config.sortBars === "desc") bars.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
        if (config.sortBars === "asc") bars.sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity));

        // ---------- Formato ----------
        const suffix = config.unitSuffix != null ? config.unitSuffix : " pts";
        const decimals = Number.isFinite(config.decimals) ? config.decimals : 1;
        const colors = [(config.barColor && config.barColor[0]) || "#12468a"]
            .concat((config.extraColors && config.extraColors.length) ? config.extraColors : ["#f39c12", "#10b981", "#ef4444", "#8b5cf6"]);
        // Formato moneda (solo si se elige en Edit → Eje Y; por default todo sigue igual)
        const isMoney = config.moneyFormat === true;
        const money = (v, forAxis) => {
            const n = Number(v), a = Math.abs(n);
            if (a >= 1e6) return "$" + (n / 1e6).toLocaleString("es-MX", { minimumFractionDigits: forAxis ? 1 : 2, maximumFractionDigits: forAxis ? 1 : 2 }) + " M";
            if (a >= 1e3) return "$" + Math.round(n / 1e3).toLocaleString("es-MX") + " mil";
            return "$" + Math.round(n).toLocaleString("es-MX");
        };
        const fmt = (v) => (v == null || isNaN(v))
            ? "-"
            : isMoney
                ? money(v, false)
                : Number(v).toLocaleString("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;

        // ---------- Eje Y ----------
        const hasNum = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
        const values = bars.flatMap(b => b.values).filter(hasNum);
        const dataMax = values.length ? Math.max(...values) : null;
        const step = (hasNum(config.yInterval) && Number(config.yInterval) > 0) ? Number(config.yInterval) : null;

        const yAxis = {
            type: "value",
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { type: [4, 4], color: "#eef0f3" } },
            axisLabel: {
                color: "#6b7280",
                fontSize: 12,
                formatter: (v) => isMoney ? money(v, true) : `${v}${suffix}`
            }
        };
        if (hasNum(config.yMin)) yAxis.min = Number(config.yMin);
        // En moneda el máximo y el intervalo son automáticos (el 100 / 25 es para calificaciones)
        if (!isMoney && hasNum(config.yMax)) {
            let max = Number(config.yMax);
            if (dataMax !== null && dataMax > max) {
                max = step ? Math.ceil(dataMax / step) * step : Math.ceil(dataMax);
            }
            yAxis.max = max;
        }
        if (step && !isMoney) yAxis.interval = step;

        // ---------- Nota inferior ----------
        const showFootnote = config.showFootnote !== false && bars.length > 0;
        const showLegend = config.showLegend !== false;
        const footnoteText = (config.footnoteCustom && config.footnoteCustom.trim())
            ? config.footnoteCustom.trim()
            : "Reglas Evaluadas: " + bars.map(b => b.name).join(", ");

        const graphic = showFootnote ? [{
            type: "text",
            left: "center",
            bottom: showLegend ? 30 : 4,
            style: {
                text: footnoteText,
                fill: "#9ca3af",
                fontSize: 12,
                fontFamily: '"Inter", -apple-system, "Segoe UI", Roboto, sans-serif'
            }
        }] : [];

        const legendTop = showLegend && config.legendTop === true;
        let bottomSpace = 12;
        if (showLegend && !legendTop) bottomSpace += 26;
        if (showFootnote) bottomSpace += 26;

        // ---------- Opciones de ECharts ----------
        const option = {
            textStyle: { fontFamily: '"Inter", -apple-system, "Segoe UI", Roboto, sans-serif' },
            tooltip: {
                trigger: "axis",
                axisPointer: { type: "shadow", shadowStyle: { color: "rgba(18,70,138,0.06)" } },
                backgroundColor: "#ffffff",
                borderColor: "#e5e7eb",
                borderWidth: 1,
                padding: [8, 12],
                textStyle: { color: "#111827", fontSize: 12 },
                extraCssText: "box-shadow: 0 4px 12px rgba(17,24,39,0.10); border-radius: 8px;",
                valueFormatter: fmt
            },
            legend: legendTop ? {
                show: true,
                top: 0,
                left: 0,
                icon: "roundRect",
                itemWidth: 12,
                itemHeight: 12,
                itemGap: 16,
                textStyle: { color: "#374151", fontSize: 13 }
            } : {
                show: showLegend,
                bottom: 0,
                icon: "circle",
                itemWidth: 14,
                itemHeight: 14,
                textStyle: { color: "#374151", fontSize: 12 }
            },
            grid: {
                top: legendTop ? 40 : 16,
                left: 8,
                right: 16,
                bottom: bottomSpace,
                containLabel: true
            },
            xAxis: {
                type: "category",
                data: bars.map(b => b.name),
                axisLine: { lineStyle: { color: "#e5e7eb" } },
                axisTick: { show: false },
                axisLabel: {
                    color: "#4b5563",
                    fontSize: 12,
                    fontWeight: 600,
                    margin: 12,
                    interval: 0,
                    lineHeight: 15,
                    // Cada etiqueta usa el ancho de su barra y parte en varias líneas si no cabe
                    width: Math.max(40, Math.floor((element.querySelector("#cpr-chart").clientWidth - 90) / Math.max(bars.length, 1)) - 8),
                    overflow: "break"
                }
            },
            yAxis,
            graphic,
            series: seriesNames.map((sName, i) => {
                const color = colors[i % colors.length];
                return {
                    name: sName,
                    type: "bar",
                    barMaxWidth: seriesNames.length > 1 ? 80 : 120,
                    barGap: "10%",
                    barCategoryGap: seriesNames.length > 1 ? "28%" : "18%",
                    itemStyle: { color, borderRadius: [4, 4, 0, 0] },
                    emphasis: { itemStyle: { color, opacity: 0.85 } },
                    label: {
                        show: config.showValues === true,
                        position: "top",
                        color: "#374151",
                        fontSize: 12,
                        fontWeight: 600,
                        formatter: (p) => fmt(p.value)
                    },
                    data: bars.map(b => b.values[i])
                };
            })
        };

        this._chart.setOption(option, true);
        this._chart.resize();
        done();
    }
});