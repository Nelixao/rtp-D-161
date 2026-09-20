from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)


# =============================================
# CONEXIÓN A LA BASE DE DATOS
# =============================================
def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME", "rtp_registro")
    )


# =============================================
# PÁGINAS
# =============================================
@app.route('/')
def inicio():
    return render_template('index.html')


@app.route('/graficas')
def pagina_graficas():
    return render_template('graficas.html')

@app.route('/predecir')
def pagina_predecir():
    return render_template('predecir.html')


# =============================================
# API: RUTAS
# =============================================
@app.route('/api/rutas', methods=['GET'])
def obtener_rutas():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, nombre, descripcion FROM rutas ORDER BY id")
        resultado = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =============================================
# API: PARADAS POR RUTA
# =============================================
@app.route('/api/paradas', methods=['GET'])
def obtener_paradas():
    ruta_id = request.args.get('ruta_id')
    if not ruta_id:
        return jsonify({"error": "Falta ruta_id"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT p.id, p.nombre
            FROM ruta_paradas rp
            JOIN paradas p ON p.id = rp.parada_id
            WHERE rp.ruta_id = %s
            ORDER BY rp.orden ASC
        """
        cursor.execute(query, (ruta_id,))
        resultado = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =============================================
# API: GUARDAR REGISTRO
# =============================================
@app.route('/api/guardar', methods=['POST'])
def guardar_registro():
    datos = request.json
    parada_id = datos.get('parada_id')
    ruta_id = datos.get('ruta_id')
    dia = datos.get('dia')
    hora = datos.get('hora')
    nota = datos.get('nota', '')

    if not parada_id or not ruta_id or not dia or not hora:
        return jsonify({"error": "Faltan campos obligatorios"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = "INSERT INTO registros (parada_id, ruta_id, dia, hora, nota) VALUES (%s, %s, %s, %s, %s)"
        cursor.execute(query, (parada_id, ruta_id, dia, hora, nota))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensaje": "Registro guardado"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =============================================
# API: REGISTROS DE UN DÍA (con promedio)
# =============================================
@app.route('/api/registros', methods=['GET'])
def obtener_registros():
    parada_id = request.args.get('parada_id')
    ruta_id = request.args.get('ruta_id')
    dia = request.args.get('dia')

    if not parada_id or not ruta_id or not dia:
        return jsonify({"error": "Faltan parámetros"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT r.id, r.hora, r.nota, r.dia,
                   p.nombre AS parada,
                   ru.nombre AS ruta
            FROM registros r
            JOIN paradas p ON p.id = r.parada_id
            JOIN rutas ru ON ru.id = r.ruta_id
            WHERE r.parada_id=%s AND r.ruta_id=%s AND r.dia=%s
            ORDER BY r.hora ASC
        """
        cursor.execute(query, (parada_id, ruta_id, dia))
        resultados = cursor.fetchall()

        if resultados:
            total_minutos = 0
            for r in resultados:
                h, m = map(int, str(r['hora']).split(':'))
                total_minutos += (h * 60) + m

            promedio_minutos = total_minutos / len(resultados)
            promedio_texto = f"{int(promedio_minutos // 60):02d}:{int(promedio_minutos % 60):02d}"

            for r in resultados:
                r['promedio'] = promedio_texto

        cursor.close()
        conn.close()
        return jsonify(resultados), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =============================================
# API: TODOS LOS REGISTROS DE UNA PARADA
# =============================================
@app.route('/api/todos-registros', methods=['GET'])
def obtener_todos_registros():
    parada_id = request.args.get('parada_id')
    ruta_id = request.args.get('ruta_id')

    if not parada_id or not ruta_id:
        return jsonify({"error": "Faltan parámetros"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT r.id, r.hora, r.nota, r.dia, r.fecha_creacion,
                   p.nombre AS parada,
                   ru.nombre AS ruta
            FROM registros r
            JOIN paradas p ON p.id = r.parada_id
            JOIN rutas ru ON ru.id = r.ruta_id
            WHERE r.parada_id=%s AND r.ruta_id=%s
            ORDER BY r.fecha_creacion ASC
        """
        cursor.execute(query, (parada_id, ruta_id))
        resultado = cursor.fetchall()
        cursor.close()
        conn.close()

        # Convertir timedelta a string
        for fila in resultado:
            if fila.get('hora') is not None:
                fila['hora'] = str(fila['hora'])
            if fila.get('fecha_creacion') is not None:
                fila['fecha_creacion'] = str(fila['fecha_creacion'])

        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =============================================
# API: ESTADÍSTICAS POR DÍA
# =============================================
@app.route('/api/estadisticas', methods=['GET'])
def obtener_estadisticas():
    parada_id = request.args.get('parada_id')
    ruta_id = request.args.get('ruta_id')

    if not parada_id or not ruta_id:
        return jsonify({"error": "Faltan parámetros"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT 
                dia,
                COUNT(*) AS total,
                AVG(TIME_TO_SEC(hora)) AS segundos_promedio
            FROM registros
            WHERE parada_id=%s AND ruta_id=%s
            GROUP BY dia
            ORDER BY FIELD(dia, 'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo')
        """
        cursor.execute(query, (parada_id, ruta_id))
        resultado = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =============================================
# API: DISTRIBUCIÓN POR HORA DEL DÍA
# =============================================
@app.route('/api/distribucion-horas', methods=['GET'])
def distribucion_horas():
    parada_id = request.args.get('parada_id')
    ruta_id = request.args.get('ruta_id')

    if not parada_id or not ruta_id:
        return jsonify({"error": "Faltan parámetros"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT 
                HOUR(hora) AS hora,
                COUNT(*) AS total
            FROM registros
            WHERE parada_id=%s AND ruta_id=%s
            GROUP BY HOUR(hora)
            ORDER BY hora
        """
        cursor.execute(query, (parada_id, ruta_id))
        resultado = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =============================================
# API: BORRAR REGISTRO
# =============================================
@app.route('/api/borrar/<int:id>', methods=['DELETE'])
def borrar_registro(id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM registros WHERE id=%s", (id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"mensaje": "Borrado"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =============================================
# API: ESTADÍSTICAS POR PARADA (para gráficas)
# =============================================
@app.route('/api/estadisticas-por-parada', methods=['GET'])
def estadisticas_por_parada():
    ruta_id = request.args.get('ruta_id')
    if not ruta_id:
        return jsonify({"error": "Falta ruta_id"}), 400
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT 
                p.id AS parada_id,
                p.nombre AS parada,
                COUNT(*) AS total,
                AVG(TIME_TO_SEC(r.hora)) AS segundos_promedio,
                MIN(r.hora) AS hora_min,
                MAX(r.hora) AS hora_max
            FROM registros r
            JOIN paradas p ON p.id = r.parada_id
            WHERE r.ruta_id = %s
            GROUP BY p.id, p.nombre
            ORDER BY p.nombre
        """
        cursor.execute(query, (ruta_id,))
        resultado = cursor.fetchall()
        cursor.close()
        conn.close()

        # Convertir timedelta a string
        for fila in resultado:
            if fila.get('hora_min') is not None:
                fila['hora_min'] = str(fila['hora_min'])
            if fila.get('hora_max') is not None:
                fila['hora_max'] = str(fila['hora_max'])

        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    # =============================================
# API: PREDICCIÓN DE LLEGADA (ETA)
# =============================================
@app.route('/api/predecir', methods=['GET'])
def predecir_llegada():
    parada_id = request.args.get('parada_id')
    ruta_id = request.args.get('ruta_id')
    dia = request.args.get('dia')

    if not parada_id or not ruta_id or not dia:
        return jsonify({"error": "Faltan parámetros"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Traer todos los registros de esa parada/día
        query = """
            SELECT TIME_TO_SEC(hora) AS segundos
            FROM registros
            WHERE parada_id=%s AND ruta_id=%s AND dia=%s
            ORDER BY hora ASC
        """
        cursor.execute(query, (parada_id, ruta_id, dia))
        registros = cursor.fetchall()

        cursor.close()
        conn.close()

        if len(registros) == 0:
            return jsonify({
                "hay_datos": False,
                "mensaje": f"Aún no tienes registros para este día ({dia})",
                "confianza": "nula"
            }), 200

        # Calcular promedio, min, max, desviación
        segundos = [r['segundos'] for r in registros]
        promedio = sum(segundos) / len(segundos)
        minimo = min(segundos)
        maximo = max(segundos)

        # Desviación estándar
        varianza = sum((s - promedio) ** 2 for s in segundos) / len(segundos)
        desviacion = varianza ** 0.5

        # Nivel de confianza según cantidad de datos
        n = len(segundos)
        if n >= 10:
            confianza = "alta"
        elif n >= 5:
            confianza = "media"
        elif n >= 2:
            confianza = "baja"
        else:
            confianza = "muy baja"

        # Sugerencia: llegar 10 min antes del promedio
        llegada_sugerida = promedio - 600  # 10 min antes en segundos
        if llegada_sugerida < 0:
            llegada_sugerida = 0

        return jsonify({
            "hay_datos": True,
            "total_registros": n,
            "promedio_segundos": promedio,
            "promedio_texto": segundos_a_hora(promedio),
            "minimo_segundos": minimo,
            "minimo_texto": segundos_a_hora(minimo),
            "maximo_segundos": maximo,
            "maximo_texto": segundos_a_hora(maximo),
            "desviacion_segundos": desviacion,
            "desviacion_texto": segundos_a_hora(desviacion),
            "rango_probable": {
                "desde": segundos_a_hora(max(0, promedio - desviacion)),
                "hasta": segundos_a_hora(promedio + desviacion)
            },
            "llegada_sugerida_texto": segundos_a_hora(llegada_sugerida),
            "confianza": confianza
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Utilidad: segundos a formato HH:MM
def segundos_a_hora(seg):
    h = int(seg // 3600)
    m = int((seg % 3600) // 60)
    return f"{h:02d}:{m:02d}"
# =============================================
# API: PREDICCIÓN MEJORADA
# =============================================
@app.route('/api/predecir-mejorado', methods=['GET'])
def predecir_mejorado():
    parada_id = request.args.get('parada_id')
    ruta_id = request.args.get('ruta_id')
    dia = request.args.get('dia')

    if not parada_id or not ruta_id or not dia:
        return jsonify({"error": "Faltan parámetros"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. Datos oficiales de la ruta
        cursor.execute("SELECT * FROM info_ruta WHERE ruta_id=%s", (ruta_id,))
        info = cursor.fetchone()

        # 2. Posición de la parada en la ruta (orden)
        cursor.execute("""
            SELECT rp.orden, COUNT(*) AS total_paradas
            FROM ruta_paradas rp
            WHERE rp.ruta_id = %s
            GROUP BY rp.orden
            ORDER BY rp.orden
        """, (ruta_id,))
        paradas_orden = cursor.fetchall()

        # Obtener el orden de la parada seleccionada
        cursor.execute("""
            SELECT orden FROM ruta_paradas 
            WHERE parada_id=%s AND ruta_id=%s
        """, (parada_id, ruta_id))
        orden_actual = cursor.fetchone()

        if not orden_actual:
            return jsonify({"error": "Parada no encontrada en esta ruta"}), 404

        posicion = orden_actual['orden']
        total_paradas = info['frecuencia_min']  # fallback

        # Obtener total de paradas de la ruta
        cursor.execute("""
            SELECT COUNT(*) AS total FROM ruta_paradas WHERE ruta_id=%s
        """, (ruta_id,))
        total_paradas = cursor.fetchone()['total']

        # 3. Registros reales para esta parada/día
        cursor.execute("""
            SELECT TIME_TO_SEC(hora) AS segundos, hora
            FROM registros
            WHERE parada_id=%s AND ruta_id=%s AND dia=%s
            ORDER BY hora ASC
        """, (parada_id, ruta_id, dia))
        registros = cursor.fetchall()

        cursor.close()
        conn.close()

        # 4. Calcular estimación teórica
        # Tiempo aproximado por parada (min)
        duracion_prom = (info['duracion_min'] + info['duracion_max']) / 2
        min_por_parada = duracion_prom / total_paradas

        # Hora de primera salida según día
        if dia in ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']:
            primera_salida = info['primera_salida_lv']
        elif dia == 'Sábado':
            primera_salida = info['primera_salida_sab']
        else:
            primera_salida = info['primera_salida_dom']

        # Convertir a segundos
        def time_a_seg(t):
            if hasattr(t, 'seconds'):
                return t.seconds
            h, m, s = map(int, str(t).split(':'))
            return h * 3600 + m * 60 + s

        primera_salida_seg = time_a_seg(primera_salida)
        ultima_salida_seg = time_a_seg(info['ultima_salida'])

        # Tiempo estimado de llegada a esta parada (desde salida de terminal)
        tiempo_hasta_parada_min = posicion * min_por_parada
        tiempo_hasta_parada_seg = tiempo_hasta_parada_min * 60

        # Rango de salidas (cada X min)
        freq_prom_seg = ((info['frecuencia_min'] + info['frecuencia_max']) / 2) * 60

        # 5. Generar tabla de próximas llegadas estimadas
        llegadas_estimadas = []
        salida_actual = primera_salida_seg
        while salida_actual + tiempo_hasta_parada_seg <= ultima_salida_seg:
            llegada = salida_actual + tiempo_hasta_parada_seg
            h = int(llegada // 3600)
            m = int((llegada % 3600) // 60)

            # Buscar si hay un registro real cercano (±10 min)
            mejor_match = None
            mejor_diff = 999999
            for r in registros:
                diff = abs(r['segundos'] - llegada)
                if diff < 600 and diff < mejor_diff:
                    mejor_diff = diff
                    mejor_match = r

            llegadas_estimadas.append({
                'hora_estimada': f"{h:02d}:{m:02d}",
                'hora_salida': f"{int(salida_actual//3600):02d}:{int((salida_actual%3600)//60):02d}",
                'tiene_dato_real': mejor_match is not None,
                'hora_real': mejor_match['hora'] if mejor_match else None,
                'diferencia_min': round(mejor_diff / 60, 1) if mejor_match else None
            })

            salida_actual += freq_prom_seg
            # Limitar a 8 próximas
            if len(llegadas_estimadas) >= 8:
                break

        # 6. Estadísticas reales (si hay)
        stats_reales = None
        if registros:
            segs = [r['segundos'] for r in registros]
            promedio = sum(segs) / len(segs)
            minimo = min(segs)
            maximo = max(segs)
            varianza = sum((s - promedio) ** 2 for s in segs) / len(segs)
            desviacion = varianza ** 0.5

            def seg_a_hora(s):
                h = int(s // 3600)
                m = int((s % 3600) // 60)
                return f"{h:02d}:{m:02d}"

            stats_reales = {
                'total': len(segs),
                'promedio': seg_a_hora(promedio),
                'minimo': seg_a_hora(minimo),
                'maximo': seg_a_hora(maximo),
                'desviacion': round(desviacion / 60, 1),
                'confianza': 'alta' if len(segs) >= 10 else ('media' if len(segs) >= 5 else 'baja')
            }

        # 7. Responder
        return jsonify({
            'parada_posicion': posicion,
            'total_paradas': total_paradas,
            'min_por_parada': round(min_por_parada, 2),
            'tiempo_hasta_parada_min': round(tiempo_hasta_parada_min, 1),
            'primera_salida': str(primera_salida),
            'ultima_salida': str(info['ultima_salida']),
            'frecuencia_min': info['frecuencia_min'],
            'frecuencia_max': info['frecuencia_max'],
            'duracion_min': info['duracion_min'],
            'duracion_max': info['duracion_max'],
            'llegadas_estimadas': llegadas_estimadas,
            'stats_reales': stats_reales
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    @app.route('/predecir')
    def pagina_predecir():
       return render_template('predecir.html')
# =============================================
# ARRANQUE
# =============================================
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)