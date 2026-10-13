/**
 * Visualización: Línea con doble eje Y
 * Medida 1 -> eje izquierdo, Medida 2 -> eje derecho (escalas independientes).
 * Requiere 1 dimensión de fecha (Month, Week o Date) + 2 medidas.
 * Carga ECharts por su cuenta si no viene como dependencia.
 */
looker.plugins.visualizations.add({
    id: "linea_doble_eje",
    label: "Línea Doble Eje",

    options: {
        chartTitle: {
            type: "string", label: "Título", section: "Texto", order: 1,
            default: "Comparativa Mensual de Conducción Óptima vs. Promedio Daño"
        },
        chartSubtitle: {
            type: "string", label: "Subtítulo", section: "Texto", order: 2,
            default: "Escalas independientes calibradas: Conducción Óptima (0-100%) vs Promedio Daño Motor (0-25 pts)"
        },
        name1: { type: "string", label: "Nombre serie izquierda (vacío = label de la medida)", default: "Conducción Óptima", section: "Texto", order: 3 },
        name2: { type: "string", label: "Nombre serie derecha (vacío = label de la medida)", default: "Promedio Daño", section: "Texto", order: 4 },

        leftSuffix: { type: "string", label: "Sufijo eje izquierdo", default: "%", section: "Eje izquierdo", order: 1 },
        leftMin: { type: "number", label: "Mínimo (vacío = automático)", default: 60, section: "Eje izquierdo", order: 2 },
        leftMax: { type: "number", label: "Máximo (vacío = automático)", default: 100, section: "Eje izquierdo", order: 3 },
        leftInterval: { type: "number", label: "Intervalo", default: 10, section: "Eje izquierdo", order: 4 },
        color1: { type: "array", label: "Color", display: "color", default: ["#12468a"], section: "Eje izquierdo", order: 5 },

        rightSuffix: { type: "string", label: "Sufijo eje derecho", default: " pts", section: "Eje derecho", order: 1 },
        rightMin: { type: "number", label: "Mínimo (vacío = automático)", default: 0, section: "Eje derecho", order: 2 },
        rightMax: { type: "number", label: "Máximo (vacío = automático)", default: 25, section: "Eje derecho", order: 3 },
        rightSplits: { type: "number", label: "Número de divisiones", default: 5, section: "Eje derecho", order: 4 },
        color2: { type: "array", label: "Color", display: "color", default: ["#e11d48"], section: "Eje derecho", order: 5 },

        decimals: { type: "number", label: "Decimales en tooltip", default: 1, section: "Estilo", order: 1 },
        smoothLine: { type: "boolean", label: "Línea suavizada", default: true, section: "Estilo", order: 2 },
        showLegend: { type: "boolean", label: "Mostrar leyenda", default: true, section: "Estilo", order: 3 },
        showCard: { type: "boolean", label: "Mostrar como tarjeta (borde y sombra)", default: true, section: "Estilo", order: 4 }
    },

    create: function (element, config) {
        element.innerHTML = `
      <style>
        .lde-wrap { width: 100%; height: 100%; box-sizing: border-box; padding: 6px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .lde-card { width: 100%; height: 100%; box-sizing: border-box; display: flex; flex-direction: column;
          background: #ffffff; padding: 18px 20px 12px 20px; border-radius: 10px; }
        .lde-card.with-border { border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(17, 24, 39, 0.06); }
        .lde-title { margin: 0; font-size: 15px; font-weight: 700; color: #111827; line-height: 1.3; }
        .lde-subtitle { margin: 4px 0 0 0; font-size: 12px; color: #6b7280; line-height: 1.4; }
        .lde-canvas { flex: 1; width: 100%; min-height: 220px; margin-top: 8px; }
        .lde-msg { display: none; margin-top: 12px; padding: 10px 12px; border-radius: 6px;
          background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 12px; }
      </style>
      <div class="lde-wrap">
        <div class="lde-card with-border" id="lde-card">
          <div>
            <h2 class="lde-title" id="lde-title"></h2>
            <p class="lde-subtitle" id="lde-subtitle"></p>
          </div>
          <div class="lde-msg" id="lde-msg"></div>
          <div class="lde-canvas" id="lde-chart"></div>
        </div>
      </div>
    `;
        const container = element.querySelector("#lde-chart");
        this._resizeObserver = new ResizeObserver(() => { if (this._chart) this._chart.resize(); });
        this._resizeObserver.observe(container);
    },

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
        const msg = element.querySelector("#lde-msg");
        if (typeof echarts === "undefined") {
            msg.style.display = "block";
            msg.textContent = "No se pudo cargar ECharts. Revisa la consola (F12) o la conexión a cdnjs.cloudflare.com.";
            return false;
        }
        msg.style.display = "none";
        if (!this._chart) this._chart = echarts.init(element.querySelector("#lde-chart"));
        return true;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
        this.clearErrors();
        const dims = queryResponse.fields.dimension_like;
        const measures = queryResponse.fields.measure_like;

        if (dims.length === 0) {
            this.addError({ id: "no-dims", title: "Falta dimensión", message: "Agrega una dimensión de fecha (Month, Week o Date) para el eje X." });
            done(); return;
        }
        if (measures.length < 2) {
            this.addError({ id: "no-measures", title: "Faltan medidas", message: "Agrega 2 medidas: la primera va al eje izquierdo y la segunda al derecho." });
            done(); return;
        }

        element.querySelector("#lde-title").textContent = config.chartTitle || "";
        element.querySelector("#lde-subtitle").textContent = config.chartSubtitle || "";
        element.querySelector("#lde-card").classList.toggle("with-border", config.showCard !== false);

        if (typeof echarts === "undefined") {
            this._loadECharts()
                .then(() => this.updateAsync(data, element, config, queryResponse, details, done))
                .catch(() => { this._ensureChart(element); done(); });
            return;
        }
        if (!this._ensureChart(element)) { done(); return; }

        // ---------- Datos ordenados por fecha ----------
        const xDim = dims[0].name;
        data = data.slice().sort((a, b) => String(a[xDim].value).localeCompare(String(b[xDim].value)));

        const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const years = new Set(data.map(r => String(r[xDim].value || "").slice(0, 4)).filter(y => /^\d{4}$/.test(y)));
        const multiYear = years.size > 1;
        const xLabel = (row) => {
            const cell = row[xDim];
            const raw = String(cell.value || "");
            const mM = raw.match(/^(\d{4})-(\d{2})$/);
            if (mM) { const m = MESES[parseInt(mM[2], 10) - 1]; return multiYear ? `${m} ${mM[1].slice(2)}` : m; }
            const mD = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (mD) { const t = `${parseInt(mD[3], 10)} ${MESES[parseInt(mD[2], 10) - 1]}`; return multiYear ? `${t} ${mD[1].slice(2)}` : t; }
            return LookerCharts.Utils.textForCell(cell);
        };

        const m1 = measures[0], m2 = measures[1];
        const toNum = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? null : Number(v);
        const vals1 = data.map(r => toNum(r[m1.name] && r[m1.name].value));
        const vals2 = data.map(r => toNum(r[m2.name] && r[m2.name].value));

        const hasNum = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
        const decimals = Number.isFinite(config.decimals) ? config.decimals : 1;
        const sfx1 = config.leftSuffix != null ? config.leftSuffix : "%";
        const sfx2 = config.rightSuffix != null ? config.rightSuffix : " pts";
        const c1 = (config.color1 && config.color1[0]) || "#12468a";
        const c2 = (config.color2 && config.color2[0]) || "#e11d48";
        const name1 = (config.name1 && config.name1.trim()) || m1.label_short || m1.label;
        const name2 = (config.name2 && config.name2.trim()) || m2.label_short || m2.label;
        const fmt = (v, sfx) => (v == null || isNaN(v)) ? "-"
            : Number(v).toLocaleString("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + sfx;

        // Ejes: respetan el rango configurado, pero se amplían si un valor queda fuera
        const buildAxis = (vals, min, max, sfx, color, position, step) => {
            const nums = vals.filter(hasNum);
            // Al ampliar el rango, redondea al múltiplo del intervalo para que las etiquetas queden parejas
            const down = (v) => step ? Math.floor(v / step) * step : Math.floor(v);
            const up = (v) => step ? Math.ceil(v / step) * step : Math.ceil(v);
            const axis = {
                type: "value",
                position,
                axisLine: { show: true, lineStyle: { color, width: 2 } },
                axisTick: { show: false },
                splitLine: position === "left" ? { lineStyle: { type: [4, 4], color: "#eef0f3" } } : { show: false },
                axisLabel: { color, fontSize: 12, fontWeight: 700, formatter: (v) => `${v}${sfx}` }
            };
            if (hasNum(min)) axis.min = nums.length ? Math.min(Number(min), down(Math.min(...nums))) : Number(min);
            if (hasNum(max)) axis.max = nums.length ? Math.max(Number(max), up(Math.max(...nums))) : Number(max);
            if (step) axis.interval = step;
            return axis;
        };

        const leftStep = hasNum(config.leftInterval) && Number(config.leftInterval) > 0 ? Number(config.leftInterval) : null;
        const yLeft = buildAxis(vals1, config.leftMin, config.leftMax, sfx1, c1, "left", leftStep);

        // Eje derecho: intervalo "redondo" a partir del rango configurado y el número de divisiones
        const splits = hasNum(config.rightSplits) && Number(config.rightSplits) > 0 ? Number(config.rightSplits) : 5;
        let rightStep = null;
        if (hasNum(config.rightMin) && hasNum(config.rightMax) && Number(config.rightMax) > Number(config.rightMin)) {
            const raw = (Number(config.rightMax) - Number(config.rightMin)) / splits;
            const pow = Math.pow(10, Math.floor(Math.log10(raw)));
            rightStep = [1, 2, 2.5, 5, 10].map(f => f * pow).find(s => s >= raw);
        }
        const yRight = buildAxis(vals2, config.rightMin, config.rightMax, sfx2, c2, "right", rightStep);

        const smooth = config.smoothLine !== false ? 0.35 : false;
        const lineSeries = (name, values, color, yAxisIndex, sfx) => ({
            name, type: "line", yAxisIndex, smooth, symbol: "circle", symbolSize: 9, connectNulls: true,
            itemStyle: { color }, lineStyle: { width: 3, color }, emphasis: { scale: 1.4 },
            tooltip: { valueFormatter: (v) => fmt(v, sfx) },
            data: values
        });

        const showLegend = config.showLegend !== false;
        this._chart.setOption({
            textStyle: { fontFamily: '"Inter", -apple-system, "Segoe UI", Roboto, sans-serif' },
            tooltip: {
                trigger: "axis", backgroundColor: "#ffffff", borderColor: "#e5e7eb", borderWidth: 1, padding: [8, 12],
                textStyle: { color: "#111827", fontSize: 12 },
                extraCssText: "box-shadow: 0 4px 12px rgba(17,24,39,0.10); border-radius: 8px;",
                axisPointer: { type: "line", lineStyle: { color: "#cbd5e1", type: "dashed" } }
            },
            legend: {
                show: showLegend, bottom: 0, icon: "circle", itemWidth: 14, itemHeight: 14, itemGap: 24,
                textStyle: { color: "#374151", fontSize: 12 }
            },
            grid: { top: 16, left: 8, right: 8, bottom: showLegend ? 44 : 12, containLabel: true },
            xAxis: {
                type: "category", boundaryGap: false, data: data.map(xLabel),
                axisLine: { lineStyle: { color: "#e5e7eb" } }, axisTick: { show: false },
                axisLabel: { color: "#4b5563", fontSize: 12, fontWeight: 600, margin: 12 }
            },
            yAxis: [yLeft, yRight],
            series: [lineSeries(name1, vals1, c1, 0, sfx1), lineSeries(name2, vals2, c2, 1, sfx2)]
        }, true);
        this._chart.resize();
        done();
    }
});