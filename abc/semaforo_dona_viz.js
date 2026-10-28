/**
 * Visualización: Unidades por Semáforo (dona)
 *
 * Cómo alimentarla (Explore "Resumen Ejecutivo Idealease"):
 *  - Sin dimensión
 *  - Medidas, en este orden: 1. Bien  2. Atención  3. Crítico
 *  - Filtro: Periodo Month = el mes que quieras ver (ej. "last month" o el último con datos)
 *  Al dar clic en un segmento abre el detalle de esas unidades.
 *
 * Carga ECharts por su cuenta.
 */
looker.plugins.visualizations.add({
    id: "semaforo_dona",
    label: "Unidades por Semáforo",

    options: {
        title: { type: "string", label: "Título", default: "Unidades por Semáforo", section: "Texto", order: 1 },
        periodText: { type: "string", label: "Texto de periodo (arriba a la derecha)", default: "", section: "Texto", order: 2 },
        centerLabel: { type: "string", label: "Texto bajo el total", default: "activas", section: "Texto", order: 3 },
        colors: { type: "array", label: "Colores (Bien, Atención, Crítico)", display: "colors", default: ["#16a34a", "#ca8a04", "#dc2626"], section: "Estilo", order: 1 },
        showCard: { type: "boolean", label: "Mostrar como tarjeta (borde y sombra)", default: true, section: "Estilo", order: 2 }
    },

    create: function (element) {
        element.innerHTML = `
      <style>
        .sd-wrap { width: 100%; height: 100%; box-sizing: border-box; padding: 6px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .sd-card { width: 100%; height: 100%; box-sizing: border-box; background: #fff; border-radius: 10px;
          padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
        .sd-card.with-border { border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(17,24,39,.06); }
        .sd-head { display: flex; justify-content: space-between; align-items: center; }
        .sd-title { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #334155; }
        .sd-period { font-size: 11px; color: #94a3b8; }
        .sd-chart { flex: 1; min-height: 160px; }
        .sd-legend { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid #f1f5f9; padding-top: 8px; }
        .sd-item { display: grid; grid-template-columns: 1fr auto 44px; gap: 10px; align-items: center; font-size: 13px; color: #334155; }
        .sd-item b { font-weight: 800; text-align: right; }
        .sd-item span.p { color: #94a3b8; text-align: right; font-size: 12px; }
        .sd-msg { display: none; padding: 8px 10px; border-radius: 6px; background: #fef2f2; color: #b91c1c; font-size: 12px; }
      </style>
      <div class="sd-wrap">
        <div class="sd-card with-border" id="sd-card">
          <div class="sd-head"><h3 class="sd-title" id="sd-title"></h3><span class="sd-period" id="sd-period"></span></div>
          <div class="sd-msg" id="sd-msg"></div>
          <div class="sd-chart" id="sd-chart"></div>
          <div class="sd-legend" id="sd-legend"></div>
        </div>
      </div>`;
        this._ro = new ResizeObserver(() => { if (this._chart) this._chart.resize(); });
        this._ro.observe(element.querySelector("#sd-chart"));
    },

    _loadECharts: function () {
        if (typeof echarts !== "undefined") return Promise.resolve();
        if (this._p) return this._p;
        this._p = new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.0/echarts.min.js";
            s.onload = resolve;
            s.onerror = () => { this._p = null; reject(); };
            document.head.appendChild(s);
        });
        return this._p;
    },

    updateAsync: function (data, element, config, queryResponse, details, done) {
        this.clearErrors();
        const measures = queryResponse.fields.measure_like;
        if (measures.length < 3 || !data.length) {
            this.addError({ id: "fields", title: "Faltan medidas", message: "Usa las medidas Bien, Atención y Crítico (en ese orden), sin dimensión." });
            done(); return;
        }
        const $ = (id) => element.querySelector("#" + id);
        $("sd-title").textContent = config.title || "";
        $("sd-period").textContent = config.periodText || "";
        $("sd-card").classList.toggle("with-border", config.showCard !== false);

        if (typeof echarts === "undefined") {
            this._loadECharts()
                .then(() => this.updateAsync(data, element, config, queryResponse, details, done))
                .catch(() => { $("sd-msg").style.display = "block"; $("sd-msg").textContent = "No se pudo cargar ECharts."; done(); });
            return;
        }
        if (!this._chart) this._chart = echarts.init($("sd-chart"));

        const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        const colors = (config.colors && config.colors.length >= 3) ? config.colors : ["#16a34a", "#ca8a04", "#dc2626"];
        const icons = ["●", "▲", "◆"];
        const row = data[0];
        const items = measures.slice(0, 3).map((m, i) => {
            const cell = row[m.name] || {};
            return { name: m.label_short || m.label, value: Number(cell.value) || 0, color: colors[i], icon: icons[i], links: cell.links || [] };
        });
        const total = items.reduce((a, b) => a + b.value, 0);

        this._chart.setOption({
            textStyle: { fontFamily: '"Inter", -apple-system, "Segoe UI", Roboto, sans-serif' },
            tooltip: { trigger: "item", formatter: (p) => `${esc(p.name)}: <b>${p.value}</b> (${total ? Math.round(p.value / total * 100) : 0}%)` },
            title: {
                text: String(total), subtext: config.centerLabel || "",
                left: "center", top: "center", itemGap: 2,
                textStyle: { fontSize: 30, fontWeight: 800, color: "#0f172a" },
                subtextStyle: { fontSize: 12, color: "#64748b" }
            },
            series: [{
                type: "pie", radius: ["62%", "86%"], avoidLabelOverlap: false,
                itemStyle: { borderColor: "#fff", borderWidth: 3 },
                label: { show: false }, labelLine: { show: false },
                data: items.map(it => ({ name: it.name, value: it.value, itemStyle: { color: it.color } }))
            }]
        }, true);
        this._chart.resize();

        this._chart.off("click");
        this._chart.on("click", (p) => {
            const it = items[p.dataIndex];
            if (it && it.links.length) LookerCharts.Utils.openDrillMenu({ links: it.links, event: p.event && p.event.event });
        });

        $("sd-legend").innerHTML = items.map(it => `
      <div class="sd-item">
        <span><span style="color:${it.color}">${it.icon}</span> &nbsp;${esc(it.name)}</span>
        <b style="color:${it.color}">${it.value.toLocaleString("es-MX")}</b>
        <span class="p">${total ? Math.round(it.value / total * 100) : 0}%</span>
      </div>`).join("");

        done();
    }
});
