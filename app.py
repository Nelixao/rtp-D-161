from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import mysql.connector

app = Flask(__name__)
CORS(app)


# =============================================
# CONEXIÓN A LA BASE DE DATOS
# =============================================
def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="1234",  # ⚠️ CAMBIA ESTO
        database="rtp_registro"
    )


# =============================================
# RUTA PRINCIPAL: sirve el HTML
# =============================================
@app.route('/')
def inicio():
    return render_template('index.html')


# =============================================
# API: OBTENER RUTAS (Ida / Vuelta)
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
# API: OBTENER PARADAS DE UNA RUTA
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
        return jsonify({"mensaje": "Registro guardado exitosamente"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =============================================
# API: OBTENER REGISTROS + PROMEDIO
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

        # Calcular promedio
        if resultados:
            total_minutos = 0
            for r in resultados:
                h, m = map(int, str(r['hora']).split(':'))
                total_minutos += (h * 60) + m

            promedio_minutos = total_minutos / len(resultados)
            horas_prom = int(promedio_minutos // 60)
            mins_prom = int(promedio_minutos % 60)
            promedio_texto = f"{horas_prom:02d}:{mins_prom:02d}"

            for r in resultados:
                r['promedio'] = promedio_texto

        cursor.close()
        conn.close()
        return jsonify(resultados), 200
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


if __name__ == '__main__':
    app.run(debug=True, port=5000)