const API_URL = "/api";

// Llenar selects de hora y minutos
const selectHora = document.getElementById('selectHora');
const selectMinuto = document.getElementById('selectMinuto');
for (let h = 1; h <= 12; h++) {
    const opt = document.createElement('option');
    opt.value = String(h).padStart(2, '0');
    opt.textContent = String(h).padStart(2, '0');
    selectHora.appendChild(opt);
}
for (let m = 0; m < 60; m++) {
    const opt = document.createElement('option');
    opt.value = String(m).padStart(2, '0');
    opt.textContent = String(m).padStart(2, '0');
    selectMinuto.appendChild(opt);
}
selectHora.value = "07";
selectMinuto.value = "30";


// Cargar rutas al inicio
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
        console.error('Error cargando rutas:', err);
    }
}


// Cargar paradas según ruta
async function cargarParadas() {
    const ruta_id = document.getElementById('selectDireccion').value;
    if (!ruta_id) return;

    try {
        const resp = await fetch(`${API_URL}/paradas?ruta_id=${ruta_id}`);
        const paradas = await resp.json();
        const selectParada = document.getElementById('selectParada');
        selectParada.innerHTML = '';
        paradas.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.nombre;
            selectParada.appendChild(opt);
        });
        await cargarRegistros();
    } catch (err) {
        console.error('Error cargando paradas:', err);
    }
}


// Guardar registro
document.getElementById('btnGuardar').addEventListener('click', async () => {
    const ruta_id = document.getElementById('selectDireccion').value;
    const parada_id = document.getElementById('selectParada').value;
    const dia = document.getElementById('selectDia').value;
    const hora12 = document.getElementById('selectHora').value;
    const minuto = document.getElementById('selectMinuto').value;
    const ampm = document.getElementById('selectAmPm').value;
    const nota = document.getElementById('inputNota').value;

    if (!parada_id) {
        alert('Selecciona una parada');
        return;
    }

    let h = parseInt(hora12);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const hora24 = String(h).padStart(2, '0') + ':' + minuto;

    const datos = { parada_id, ruta_id, dia, hora: hora24, nota };

    try {
        const resp = await fetch(`${API_URL}/guardar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        const resultado = await resp.json();
        if (resp.ok) {
            document.getElementById('inputNota').value = '';
            await cargarRegistros();
        } else {
            alert('Error: ' + (resultado.error || 'desconocido'));
        }
    } catch (err) {
        alert('No se pudo conectar: ' + err.message);
    }
});


// Cargar registros del día seleccionado
async function cargarRegistros() {
    const ruta_id = document.getElementById('selectDireccion').value;
    const parada_id = document.getElementById('selectParada').value;
    const dia = document.getElementById('selectDia').value;

    if (!parada_id || !ruta_id) return;

    const paradaTexto = document.getElementById('selectParada').selectedOptions[0]?.textContent || '—';
    const dirTexto = document.getElementById('selectDireccion').selectedOptions[0]?.textContent.split('→')[0].trim() || '—';

    document.getElementById('nombreParada').textContent = paradaTexto;
    document.getElementById('badgeDir').textContent = dirTexto;
    document.getElementById('badgeDia').textContent = dia;

    try {
        const resp = await fetch(
            `${API_URL}/registros?parada_id=${parada_id}&ruta_id=${ruta_id}&dia=${encodeURIComponent(dia)}`
        );
        const registros = await resp.json();

        const tbody = document.getElementById('tablaRegistros');
        tbody.innerHTML = '';
        let promedioTexto = '0 reg';

        registros.forEach(reg => {
            const fila = document.createElement('tr');
            fila.innerHTML = `
                <td>${reg.hora}</td>
                <td>${reg.nota || '—'}</td>
                <td><button class="btn-borrar" onclick="borrarRegistro(${reg.id})">✕</button></td>
            `;
            tbody.appendChild(fila);
            if (reg.promedio) {
                promedioTexto = `${registros.length} reg · prom ${reg.promedio}`;
            }
        });

        document.getElementById('badgeProm').textContent = promedioTexto;
    } catch (err) {
        console.error('Error cargando registros:', err);
    }
}


// Borrar registro
async function borrarRegistro(id) {
    if (!confirm('¿Borrar este registro?')) return;
    try {
        await fetch(`${API_URL}/borrar/${id}`, { method: 'DELETE' });
        await cargarRegistros();
    } catch (err) {
        alert('No se pudo borrar');
    }
}


// Eventos
document.getElementById('selectDireccion').addEventListener('change', cargarParadas);
document.getElementById('selectParada').addEventListener('change', cargarRegistros);
document.getElementById('selectDia').addEventListener('change', cargarRegistros);

cargarRutas();