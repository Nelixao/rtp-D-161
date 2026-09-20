const API_URL = "/api";
let gPromedios = null, gCantidad = null, gTimeline = null;

const COLORES = [
    '#4ade80', '#60a5fa', '#f472b6', '#facc15', '#a78bfa',
    '#fb923c', '#2dd4bf', '#f87171', '#c084fc', '#22d3ee'
];


// =============================================
// CARGAR RUTAS (punto de entrada)
// =============================================
async function cargarRutas() {
    try {
        const resp = await fetch(`${API_URL}/rutas`);
        const rutas = await resp.json();
        const select = document.getElementById('selectDireccion');
        select.innerHTML = '';
        rutas.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = `${r.nombre} → ${r.descripcion}`;
            select.appendChild(opt);
        });
        await cargarTodo();
    } catch (err) {
        console.error('Error cargando rutas:', err);
    }
}


// =============================================
// CARGAR TODO
// =============================================
async function cargarTodo() {
    const ruta_id = document.getElementById('selectDireccion').value;
    if (!ruta_id) return;

    await cargarParadasParaPrediccion();
    await cargarEstadisticas(ruta_id);
    await cargarTimeline(ruta_id);
}


// =============================================
// GRÁFICAS DE ESTADÍSTICAS
// =============================================
async function cargarEstadisticas(ruta_id) {
    try {
        const resp = await fetch(`${API_URL}/estadisticas-por-parada?ruta_id=${ruta_id}`);
        const datos = await resp.json();

        const total = datos.reduce((acc, d) => acc + d.total, 0);
        document.getElementById('statTotal').textContent = total;
        document.getElementById('statParadas').textContent = datos.length;

        // Gráfica 1: hora promedio
        const ctx1 = document.getElementById('graficaPromedios').getContext('2d');
        if (gPromedios) gPromedios.destroy();

        gPromedios = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: datos.map(d => d.parada),
                datasets: [{
                    label: 'Hora promedio',
                    data: datos.map(d => d.segundos_promedio / 3600),
                    backgroundColor: datos.map((_, i) => COLORES[i % COLORES.length] + '99'),
                    borderColor: datos.map((_, i) => COLORES[i % COLORES.length]),
                    borderWidth: 1.5,
                    borderRadius: 8,
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        callbacks: {
                            label: (ctx) => {
                                const h = Math.floor(ctx.raw);
                                const m = Math.round((ctx.raw - h) * 60);
                                return `Promedio: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: 'rgba(255,255,255,0.6)',
                            callback: (val) => {
                                const h = Math.floor(val);
                                const m = Math.round((val - h) * 60);
                                return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
                            }
                        },
                        grid: { color: 'rgba(255,255,255,0.08)' },
                        min: 4,
                        max: 23,
                    },
                    y: {
                        ticks: { color: 'rgba(255,255,255,0.8)', font: { size: 11 } },
                        grid: { display: false }
                    }
                }
            }
        });

        // Gráfica 2: cantidad
        const ctx2 = document.getElementById('graficaCantidad').getContext('2d');
        if (gCantidad) gCantidad.destroy();

        gCantidad = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: datos.map(d => d.parada),
                datasets: [{
                    label: 'Registros',
                    data: datos.map(d => d.total),
                    backgroundColor: datos.map((_, i) => COLORES[i % COLORES.length] + '99'),
                    borderColor: datos.map((_, i) => COLORES[i % COLORES.length]),
                    borderWidth: 1.5,
                    borderRadius: 8,
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        callbacks: {
                            label: (ctx) => `${ctx.raw} registros`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { color: 'rgba(255,255,255,0.6)', stepSize: 1, precision: 0 },
                        grid: { color: 'rgba(255,255,255,0.08)' }
                    },
                    y: {
                        ticks: { color: 'rgba(255,255,255,0.8)', font: { size: 11 } },
                        grid: { display: false }
                    }
                }
            }
        });
    } catch (err) {
        console.error('Error cargando estadísticas:', err);
    }
}


// =============================================
// GRÁFICA TIMELINE
// =============================================
async function cargarTimeline(ruta_id) {
    try {
        const respParadas = await fetch(`${API_URL}/paradas?ruta_id=${ruta_id}`);
        const paradas = await respParadas.json();

        const todasLasSeries = [];
        for (const parada of paradas) {
            const resp = await fetch(`${API_URL}/todos-registros?parada_id=${parada.id}&ruta_id=${ruta_id}`);
            const regs = await resp.json();
            if (regs.length > 0) {
                todasLasSeries.push({
                    parada: parada.nombre,
                    registros: regs
                });
            }
        }

        const ctx = document.getElementById('graficaTimeline').getContext('2d');
        if (gTimeline) gTimeline.destroy();

        if (todasLasSeries.length === 0) {
            return;
        }

        const fechasSet = new Set();
        todasLasSeries.forEach(s => {
            s.registros.forEach(r => {
                fechasSet.add(r.fecha_creacion.split(' ')[0]);
            });
        });
        const fechas = Array.from(fechasSet).sort();

        const datasets = todasLasSeries.map((serie, i) => ({
            label: serie.parada,
            data: fechas.map(fecha => {
                const regs = serie.registros.filter(r => r.fecha_creacion.startsWith(fecha));
                if (regs.length === 0) return null;
                const totalSeg = regs.reduce((acc, r) => {
                    const [h, m] = r.hora.split(':');
                    return acc + (parseInt(h) * 3600) + (parseInt(m) * 60);
                }, 0);
                return (totalSeg / regs.length) / 3600;
            }),
            borderColor: COLORES[i % COLORES.length],
            backgroundColor: COLORES[i % COLORES.length] + '33',
            tension: 0.3,
            fill: false,
            pointBackgroundColor: COLORES[i % COLORES.length],
            pointRadius: 5,
            pointHoverRadius: 7,
            spanGaps: true,
        }));

        gTimeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: fechas.map(f => {
                    const [y, m, d] = f.split('-');
                    return `${d}/${m}`;
                }),
                datasets: datasets
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: 'rgba(255,255,255,0.8)', font: { size: 11 } } },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        callbacks: {
                            label: (ctx) => {
                                if (ctx.raw === null) return 'Sin registro';
                                const h = Math.floor(ctx.raw);
                                const m = Math.round((ctx.raw - h) * 60);
                                return `${ctx.dataset.label}: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: 'rgba(255,255,255,0.6)' },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    y: {
                        ticks: {
                            color: 'rgba(255,255,255,0.6)',
                            callback: (val) => {
                                const h = Math.floor(val);
                                const m = Math.round((val - h) * 60);
                                return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
                            }
                        },
                        grid: { color: 'rgba(255,255,255,0.08)' },
                        min: 4,
                        max: 23,
                    }
                }
            }
        });
    } catch (err) {
        console.error('Error cargando timeline:', err);
    }
}


// =============================================
// PREDICCIÓN
// =============================================
async function cargarParadasParaPrediccion() {
    const ruta_id = document.getElementById('selectDireccion').value;
    if (!ruta_id) return;

    try {
        const resp = await fetch(`${API_URL}/paradas?ruta_id=${ruta_id}`);
        const paradas = await resp.json();
        const select = document.getElementById('selectParadaPredecir');
        select.innerHTML = '';
        paradas.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.nombre;
            select.appendChild(opt);
        });
        await predecir();
    } catch (err) {
        console.error('Error paradas prediccion:', err);
    }
}


async function predecir() {
    const parada_id = document.getElementById('selectParadaPredecir').value;
    const ruta_id = document.getElementById('selectDireccion').value;
    const dia = document.getElementById('selectDiaPredecir').value;

    if (!parada_id) return;

    try {
        const resp = await fetch(
            `${API_URL}/predecir?parada_id=${parada_id}&ruta_id=${ruta_id}&dia=${encodeURIComponent(dia)}`
        );
        const data = await resp.json();

        const cont = document.getElementById('prediccion');

        if (!data.hay_datos) {
            cont.innerHTML = `
                <div style="padding: 20px; text-align: center; color: rgba(255,255,255,0.5);">
                    📭 ${data.mensaje}
                </div>
            `;
            return;
        }

        const colorConfianza = {
            'alta': '#4ade80',
            'media': '#facc15',
            'baja': '#fb923c',
            'muy baja': '#f87171'
        }[data.confianza] || '#888';

        cont.innerHTML = `
            <div style="display:grid; gap:12px;">
                <div style="background: rgba(74,222,128,0.15); border:1px solid rgba(74,222,128,0.3); border-radius:12px; padding:16px;">
                    <div style="color: rgba(255,255,255,0.6); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px;">Hora promedio</div>
                    <div style="font-size:1.8rem; font-weight:700; color:#4ade80; margin-top:4px;">${data.promedio_texto}</div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div style="background: rgba(255,255,255,0.05); border-radius:10px; padding:12px;">
                        <div style="color: rgba(255,255,255,0.5); font-size:0.7rem; text-transform:uppercase;">Más temprano</div>
                        <div style="font-size:1.1rem; font-weight:600;">${data.minimo_texto}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); border-radius:10px; padding:12px;">
                        <div style="color: rgba(255,255,255,0.5); font-size:0.7rem; text-transform:uppercase;">Más tarde</div>
                        <div style="font-size:1.1rem; font-weight:600;">${data.maximo_texto}</div>
                    </div>
                </div>

                <div style="background: rgba(96,165,250,0.12); border:1px solid rgba(96,165,250,0.3); border-radius:12px; padding:14px;">
                    <div style="color: rgba(255,255,255,0.6); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px;">🎯 Rango probable</div>
                    <div style="font-size:1.3rem; font-weight:700; color:#60a5fa; margin-top:4px;">
                        ${data.rango_probable.desde} – ${data.rango_probable.hasta}
                    </div>
                </div>

                <div style="background: rgba(250,204,21,0.12); border:1px solid rgba(250,204,21,0.3); border-radius:12px; padding:14px;">
                    <div style="color: rgba(255,255,255,0.6); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px;">⏰ Llega a la parada a las</div>
                    <div style="font-size:1.3rem; font-weight:700; color:#facc15; margin-top:4px;">
                        ${data.llegada_sugerida_texto}
                    </div>
                    <div style="color: rgba(255,255,255,0.5); font-size:0.75rem; margin-top:6px;">
                        (10 minutos antes del promedio)
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid rgba(255,255,255,0.08);">
                    <div style="color: rgba(255,255,255,0.5); font-size:0.8rem;">
                        📊 ${data.total_registros} registro${data.total_registros > 1 ? 's' : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="color: rgba(255,255,255,0.5); font-size:0.8rem;">Confianza:</span>
                        <span style="background: ${colorConfianza}22; color: ${colorConfianza}; padding:3px 10px; border-radius:6px; font-size:0.75rem; font-weight:600; text-transform:uppercase;">
                            ${data.confianza}
                        </span>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Error prediccion:', err);
    }
}


// =============================================
// EVENTOS E INICIO
// =============================================
document.getElementById('selectDireccion').addEventListener('change', cargarTodo);
document.getElementById('selectDiaPredecir').addEventListener('change', predecir);
document.getElementById('selectParadaPredecir').addEventListener('change', predecir);

// Iniciar
cargarRutas();