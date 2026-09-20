const API_URL = "/api";


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
        await cargarParadas();
    } catch (err) {
        console.error('Error rutas:', err);
    }
}


async function cargarParadas() {
    const ruta_id = document.getElementById('selectDireccion').value;
    if (!ruta_id) return;

    try {
        const resp = await fetch(`${API_URL}/paradas?ruta_id=${ruta_id}`);
        const paradas = await resp.json();
        const select = document.getElementById('selectParada');
        select.innerHTML = '';
        paradas.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.nombre;
            select.appendChild(opt);
        });
        await predecir();
    } catch (err) {
        console.error('Error paradas:', err);
    }
}


async function predecir() {
    const parada_id = document.getElementById('selectParada').value;
    const ruta_id = document.getElementById('selectDireccion').value;
    const dia = document.getElementById('selectDia').value;

    if (!parada_id || !ruta_id) return;

    try {
        const resp = await fetch(
            `${API_URL}/predecir-mejorado?parada_id=${parada_id}&ruta_id=${ruta_id}&dia=${encodeURIComponent(dia)}`
        );
        const data = await resp.json();

        if (data.error) {
            document.getElementById('infoRuta').innerHTML = 
                `<div class="grafica-card" style="color:#ef4444;">${data.error}</div>`;
            document.getElementById('statsReales').innerHTML = '';
            document.getElementById('llegadas').innerHTML = '';
            return;
        }

        // --- BLOQUE DESTACADO: Próxima llegada ---
        const proximaLlegadaHTML = data.proxima_llegada_parada ? `
            <div style="
                background: linear-gradient(135deg, rgba(74,222,128,0.25) 0%, rgba(34,197,94,0.15) 100%);
                border: 2px solid rgba(74,222,128,0.5);
                border-radius: 16px;
                padding: 20px;
                margin-bottom: 20px;
                text-align: center;
                box-shadow: 0 8px 32px rgba(74,222,128,0.2);
            ">
                <div style="color: rgba(255,255,255,0.7); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">
                    🚌 Próximo camión
                </div>
                <div style="color: #4ade80; font-size: 2.8rem; font-weight: 800; margin: 8px 0; line-height: 1;">
                    ${data.proxima_llegada_parada}
                </div>
                <div style="color: rgba(255,255,255,0.8); font-size: 1rem;">
                    en <b>${data.proxima_minutos_espera} min</b>
                </div>
                <div style="color: rgba(255,255,255,0.5); font-size: 0.75rem; margin-top: 8px;">
                    Hora actual: ${data.hora_actual} · Sale de terminal: ${data.proxima_salida_terminal}
                </div>
            </div>
        ` : `
            <div class="grafica-card" style="text-align: center; color: rgba(255,255,255,0.6);">
                🚫 No hay más camiones hoy. Última salida: ${data.ultima_salida}
            </div>
        `;

        // --- Info de la ruta ---
        const infoRutaHTML = `
            <div class="grafica-card">
                <h3>ℹ️ Datos de la ruta</h3>
                <div class="descripcion">Información oficial de la RTP 161-D.</div>
                <div class="info-box">
                    <div class="info-item">
                        <div class="info-label">Tu parada</div>
                        <div class="info-value">#${data.parada.posicion} / ${data.parada.total_paradas}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Frecuencia</div>
                        <div class="info-value">${data.frecuencia_min}-${data.frecuencia_max} min</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Llegada a tu parada</div>
                        <div class="info-value">~${data.tiempo_hasta_parada_min} min</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Primera salida</div>
                        <div class="info-value" style="font-size:1rem;">${data.primera_salida}</div>
                    </div>
                </div>
            </div>
        `;

        // --- Stats reales ---
        let statsHTML = '';
        if (data.stats_reales) {
            const s = data.stats_reales;
            statsHTML = `
                <div class="grafica-card">
                    <h3>📊 Tus registros reales</h3>
                    <div class="descripcion">Basado en ${s.total} registro(s) que has hecho este día.</div>
                    <div class="info-box" style="background: rgba(74,222,128,0.1); border-color: rgba(74,222,128,0.25);">
                        <div class="info-item">
                            <div class="info-label">Promedio</div>
                            <div class="info-value" style="color:#4ade80;">${s.promedio}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Rango</div>
                            <div class="info-value" style="color:#4ade80; font-size:1rem;">${s.minimo} – ${s.maximo}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Desviación</div>
                            <div class="info-value" style="color:#4ade80; font-size:1rem;">±${s.desviacion} min</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Confianza</div>
                            <div class="info-value" style="color:#4ade80; font-size:1rem;">${s.confianza}</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            statsHTML = `
                <div class="grafica-card" style="text-align: center;">
                    <div style="color: rgba(255,255,255,0.5); padding: 12px;">
                        📭 Aún no tienes registros para este día.<br>
                        <span style="font-size: 0.8rem;">Registra más veces para mejorar la predicción.</span>
                    </div>
                </div>
            `;
        }

        // --- Llegadas futuras ---
        let llegadasHTML = '';
        if (data.llegadas_estimadas.length > 1) {
            llegadasHTML = `
                <div class="grafica-card">
                    <h3>📅 Siguientes llegadas</h3>
                    <div class="descripcion">Próximas 5 llegadas a tu parada.</div>
                    <div style="margin-top: 12px;">
                        ${data.llegadas_estimadas.slice(1).map(l => `
                            <div class="llegada-item ${l.tiene_dato_real ? 'real' : ''}">
                                <div>
                                    <div class="llegada-hora">${l.hora_estimada}</div>
                                    <div class="llegada-sub">Sale de terminal: ${l.hora_salida} · En ${l.minutos_espera} min</div>
                                </div>
                                ${l.tiene_dato_real ? `
                                    <div class="llegada-badge">✓ Real: ${l.hora_real.substring(0,5)}</div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        document.getElementById('infoRuta').innerHTML = proximaLlegadaHTML + infoRutaHTML;
        document.getElementById('statsReales').innerHTML = statsHTML;
        document.getElementById('llegadas').innerHTML = llegadasHTML;

    } catch (err) {
        console.error('Error predicción:', err);
    }
}


// Eventos
document.getElementById('selectDireccion').addEventListener('change', cargarParadas);
document.getElementById('selectParada').addEventListener('change', predecir);
document.getElementById('selectDia').addEventListener('change', predecir);

// Iniciar
cargarRutas();

// Auto-refresh cada 60 segundos (solo si la pestaña está visible)
setInterval(() => {
    if (document.visibilityState === 'visible') {
        predecir();
    }
}, 60000);