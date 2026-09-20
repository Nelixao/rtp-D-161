#  RTP 161-D — Registro de tiempos

Aplicación web para registrar y predecir los tiempos de paso del autobús **RTP 161-D** (Colonia Buenavista/Parajes ↔ Central de Abasto) en la Ciudad de México.

Permite guardar la hora exacta a la que ves pasar el camión en cada parada, calcular promedios, visualizar gráficas y **predecir cuándo pasará el próximo** basándose en datos oficiales de la ruta + tus registros reales.

---

##  Características

-  **Registro rápido**: guarda la hora a la que ves el camión en cualquier parada, con nota opcional.
-  **Predicción inteligente**: calcula la próxima llegada usando la frecuencia oficial (20-35 min) y la posición de tu parada en la ruta.
-  **Gráficas interactivas**: promedios por parada, distribución por hora y evolución temporal.
-  **Mapa integrado**: visualiza la ruta completa con todas las paradas.
-  **Mobile-first**: diseñado para usarse desde el iPhone mientras esperas el camión.
-  **Interfaz moderna**: estilo *glassmorphism* con fondo degradado y tarjetas translúcidas.
-  **Datos locales**: tu información vive en tu propia base de datos MySQL.

---

##  Tecnologías

| Capa | Tecnología |
|---|---|
| Backend | Python 3 + Flask |
| Base de datos | MySQL (Workbench) |
| Frontend | HTML5 + CSS3 + JavaScript vanilla |
| Gráficas | Chart.js |
| Mapa | Google My Maps (embed) |
| Servidor de desarrollo | Flask dev server |
| Exposición pública (opcional) | ngrok |

---

##  Requisitos previos

- **Python 3.10+**
- **MySQL 8+** (con MySQL Workbench recomendado)
- **pip** y **venv**
- Opcional: **ngrok** (para acceder desde el celular fuera de casa)

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/Nelixao/rtp-D-161.git
cd rtp-D-161
