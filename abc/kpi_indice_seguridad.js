/**
 * Visualización: Tarjeta KPI con variación
 * Valor grande + sufijo ("/ 100") + badge de variación vs periodo anterior.
 *
 * Formas de alimentarla:
 *  A) 1 dimensión de fecha (ej. Fecha Month) + 1 medida  -> compara el periodo más reciente vs el anterior.
 *  B) Sin dimensión, 2 medidas (actual, anterior)        -> compara medida 1 vs medida 2.
 *  C) Sin dimensión, 1 medida                            -> muestra solo el valor, sin badge.
 *
 * No requiere dependencias externas.
 */
looker.plugins.visualizations.add({
    id: "kpi_card_variacion",
    label: "KPI con Variación",

    options: {
        kpiTitle: {
            type: "string",
            label: "Título",
            default: "Índice de Seguridad",
            section: "Texto",
            order: 1
        },
        valueSuffix: {
            type: "string",
            label: "Sufijo del valor",
            default: "/ 100",
            section: "Texto",
            order: 2
        },
        caption: {
            type: "string",
            label: "Texto junto al badge",
            default: "eficiencia en seguridad vial",
            section: "Texto",
            order: 3
        },
        decimals: {
            type: "number",
            label: "Decimales del valor",
            default: 1,
            section: "Formato",
            order: 1
        },
        changeMode: {
            type: "string",
            label: "Tipo de variación",
            display: "select",
            values: [
                { "Porcentaje (%)": "percent" },
                { "Diferencia absoluta (pts)": "absolute" }
            ],
            default: "percent",
            section: "Formato",
            order: 2
        },
        changeDecimals: {
            type: "number",
            label: "Decimales de la variación",
            default: 1,
            section: "Formato",
            order: 3
        },
        higherIsBetter: {
            type: "boolean",
            label: "Subir es positivo (verde)",
            default: true,
            section: "Formato",
            order: 4
        },
        showIcon: {
            type: "boolean",
            label: "Mostrar ícono",
            default: true,
            section: "Estilo",
            order: 1
        },
        accentColor: {
            type: "array",
            label: "Color del ícono",
            display: "color",
            default: ["#1f4e9a"],
            section: "Estilo",
            order: 2
        },
        showCard: {
            type: "boolean",
            label: "Mostrar como tarjeta (borde y sombra)",
            default: true,
            section: "Estilo",
            order: 3
        }
    },

    create: function (element, config) {
        element.innerHTML = `
      <style>
        .kpi-wrap {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          padding: 6px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .kpi-card {
          position: relative;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          background: #ffffff;
          border-radius: 10px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
        }
        .kpi-card.with-border {
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px rgba(17, 24, 39, 0.06);
        }
        .kpi-title {
          margin: 0;
          padding-right: 40px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #475569;
        }
        .kpi-icon {
          position: absolute;
          top: 14px;
          right: 16px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #c7d2e3;
          background: #eef3fa;
        }
        .kpi-icon svg { width: 16px; height: 16px; }
        .kpi-value-row {
          display: flex;
          align-items: baseline;
          gap: 6px;
          line-height: 1;
        }
        .kpi-value {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.01em;
        }
        .kpi-suffix {
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
        }
        .kpi-foot {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .kpi-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid transparent;
        }
        .kpi-badge svg { width: 13px; height: 13px; }
        .kpi-badge.good    { color: #047857; background: #ecfdf5; border-color: #a7f3d0; }
        .kpi-badge.bad     { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
        .kpi-badge.neutral { color: #475569; background: #f1f5f9; border-color: #e2e8f0; }
        .kpi-caption {
          font-size: 12px;
          color: #64748b;
        }
        .kpi-hidden { display: none !important; }
      </style>
      <div class="kpi-wrap">
        <div class="kpi-card with-border" id="kpi-card">
          <div class="kpi-icon" id="kpi-icon"></div>
          <h3 class="kpi-title" id="kpi-title"></h3>
          <div class="kpi-value-row">
            <span class="kpi-value" id="kpi-value">-</span>
            <span class="kpi-suffix" id="kpi-suffix"></span>
          </div>
          <div class="kpi-foot" id="kpi-foot">
            <span class="kpi-badge" id="kpi-badge"></span>
            <span class="kpi-caption" id="kpi-caption"></span>
          </div>
        </div>
      </div>
    `;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
        this.clearErrors();

        const dims = queryResponse.fields.dimension_like;
        const measures = queryResponse.fields.measure_like;

        if (measures.length === 0) {
            this.addError({ id: "no-measures", title: "Falta medida", message: "Selecciona al menos una medida (por ejemplo, Índice de Seguridad)." });
            done();
            return;
        }
        if (!data || data.length === 0) {
            this.addError({ id: "no-data", title: "Sin datos", message: "La consulta no regresó resultados." });
            done();
            return;
        }

        const $ = (id) => element.querySelector("#" + id);
        const toNum = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? null : Number(v);

        // ---------- Obtener valor actual y anterior ----------
        let current = null;
        let previous = null;
        const m0 = measures[0].name;

        if (dims.length > 0) {
            // Ordena por la primera dimensión (fecha) de más antiguo a más reciente,
            // así no importa el orden que tenga el Explore.
            const d0 = dims[0].name;
            const rows = data
                .filter(r => r[m0] && toNum(r[m0].value) !== null)
                .slice()
                .sort((a, b) => String(a[d0].value).localeCompare(String(b[d0].value)));

            if (rows.length > 0) current = toNum(rows[rows.length - 1][m0].value);
            if (rows.length > 1) previous = toNum(rows[rows.length - 2][m0].value);
        } else {
            current = toNum(data[0][m0] && data[0][m0].value);
            if (measures.length > 1) {
                const m1 = measures[1].name;
                previous = toNum(data[0][m1] && data[0][m1].value);
            }
        }

        // ---------- Texto y valor ----------
        const decimals = Number.isFinite(config.decimals) ? config.decimals : 1;
        const changeDecimals = Number.isFinite(config.changeDecimals) ? config.changeDecimals : 1;

        $("kpi-title").textContent = config.kpiTitle || measures[0].label_short || measures[0].label;
        $("kpi-value").textContent = current === null
            ? "-"
            : current.toLocaleString("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        $("kpi-suffix").textContent = config.valueSuffix || "";
        $("kpi-caption").textContent = config.caption || "";
        $("kpi-card").classList.toggle("with-border", config.showCard !== false);

        // ---------- Ícono ----------
        const accent = (config.accentColor && config.accentColor[0]) || "#1f4e9a";
        const iconEl = $("kpi-icon");
        iconEl.classList.toggle("kpi-hidden", config.showIcon === false);
        iconEl.innerHTML = `
      <svg viewBox="0 0 16 16" fill="${accent}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11.5" cy="3.5" r="2"/>
        <circle cx="6" cy="6.5" r="1.8"/>
        <circle cx="10.5" cy="9" r="1.6"/>
        <circle cx="4.5" cy="12" r="1.8"/>
        <circle cx="13" cy="13" r="1.2"/>
      </svg>`;

        // ---------- Badge de variación ----------
        const badge = $("kpi-badge");
        const foot = $("kpi-foot");

        if (current === null || previous === null) {
            badge.classList.add("kpi-hidden");
            foot.classList.toggle("kpi-hidden", !config.caption);
        } else {
            badge.classList.remove("kpi-hidden");
            foot.classList.remove("kpi-hidden");

            let change;
            let changeText;
            if (config.changeMode === "absolute") {
                change = current - previous;
                changeText = (change > 0 ? "+" : "") +
                    change.toLocaleString("es-MX", { minimumFractionDigits: changeDecimals, maximumFractionDigits: changeDecimals }) + " pts";
            } else {
                change = previous === 0 ? 0 : ((current - previous) / Math.abs(previous)) * 100;
                changeText = (change > 0 ? "+" : "") +
                    change.toLocaleString("es-MX", { minimumFractionDigits: changeDecimals, maximumFractionDigits: changeDecimals }) + "%";
            }

            const rounded = Number(change.toFixed(changeDecimals));
            const higherIsBetter = config.higherIsBetter !== false;
            let state = "neutral";
            if (rounded > 0) state = higherIsBetter ? "good" : "bad";
            if (rounded < 0) state = higherIsBetter ? "bad" : "good";

            const arrowUp = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5,11.5 6,7 9,10 14.5,4.5"/><polyline points="10.5,4.5 14.5,4.5 14.5,8.5"/></svg>`;
            const arrowDown = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5,4.5 6,9 9,6 14.5,11.5"/><polyline points="10.5,11.5 14.5,11.5 14.5,7.5"/></svg>`;
            const flat = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="2" y1="8" x2="14" y2="8"/></svg>`;

            badge.className = "kpi-badge " + state;
            badge.innerHTML = (rounded > 0 ? arrowUp : rounded < 0 ? arrowDown : flat) + `<span>${changeText}</span>`;
        }

        done();
    }
});