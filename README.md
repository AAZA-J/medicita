# MediCita

Sistema web para gestionar las citas y la atención de un centro médico. Los pacientes pueden ver los horarios libres, reservar, confirmar y cancelar sus citas en línea. La recepcionista agenda a quienes llaman o llegan en persona, el médico registra el seguimiento de cada atención y el administrador gestiona especialidades, médicos y horarios.

Proyecto final de la asignatura **Gestión de Proyectos de Software**
Universidad Laica Eloy Alfaro de Manabí, campus Flavio Alfaro. Periodo 2026-2.
Docente: Ing. Jefferson Roney Palma Mecias.

## Equipo

| Integrante | Rol |
| --- | --- |
| Argenis Alexander Zambrano Alcívar | Project Manager y Scrum Master |
| Jean Leandro Ordoñez Ceballos | Coordinador Técnico y de Producto (Product Owner) |
| Clarissa Jamileth Quijije Barberan | Analista de requisitos y diseñadora UX/UI |
| Widinson Hernan Montalvan Almeida | Desarrollador full-stack y responsable del repositorio |
| Sara Damaris Zambrano Marcillo | Calidad, pruebas y documentación |

## Módulos

1. Solicitud y cancelación de citas
2. Consulta de disponibilidad
3. Gestión de especialidades, médicos y horarios
4. Confirmación de citas con recordatorio por correo (y WhatsApp como opcional)
5. Seguimiento de la atención

## Tecnología

| Parte | Tecnología |
| --- | --- |
| Frontend | React 18 con Vite y React Router |
| Backend | Node.js 22 con NestJS 11 (API REST) |
| Base de datos | PostgreSQL 18 |
| Correo | Nodemailer (SMTP, por ejemplo Gmail) |
| Despliegue | Docker y Docker Compose |

## Estructura del repositorio

```
medicita/
├── backend/        API en NestJS
│   └── src/
│       ├── auth/                 Inicio de sesión, registro y permisos por rol
│       ├── catalogo.controller   Especialidades, médicos y horarios
│       ├── citas.service         Disponibilidad, reservas, cancelaciones, agenda y seguimiento
│       ├── recordatorios.service Recordatorios por correo y WhatsApp
│       └── otros.controller      Confirmación desde el correo y resumen mensual
├── frontend/       Aplicación en React
│   └── src/
│       ├── pages/                Pantallas de cada rol
│       └── components/           Reserva paso a paso y selector de horarios
├── database/       Script SQL, código para dbdiagram.io y copia de seguridad
├── docs/           Informe, diagramas y cronograma
└── docker-compose.yml
```

## Cómo correr el sistema en tu computadora

Necesitas tener instalado **PostgreSQL** (con pgAdmin) y **Node.js 22** (descargar la versión LTS de nodejs.org).

### 1. Base de datos

1. En pgAdmin, crear una base de datos llamada `medicita`.
2. Clic derecho sobre `medicita` > **Query Tool**.
3. Abrir `database/MediCita_base_de_datos.sql` y ejecutarlo con **F5**.

Si ya la tenían creada de antes, no hace falta repetir este paso.

### 2. Backend (API)

Abrir una terminal en la carpeta del proyecto:

```
cd backend
copy env.example .env        (en Mac o Linux: cp env.example .env)
npm install
npm run dev
```

Antes de `npm run dev`, abrir el archivo `.env` y poner en `DB_PASSWORD` la contraseña que usaron al instalar PostgreSQL. Cuando funcione aparece: `API de MediCita lista en http://localhost:3000/api`.

### 3. Frontend

En **otra** terminal:

```
cd frontend
npm install
npm run dev
```

Abrir **http://localhost:5173** en el navegador.

### Con Docker (opcional)

Si tienen Docker Desktop, todo se levanta con un solo comando desde la carpeta del proyecto:

```
docker compose up --build
```

y se abre **http://localhost:8080**.

## Usuarios de prueba

Todos tienen la contraseña `Prueba123`.

| Rol | Correo |
| --- | --- |
| Administrador | admin@medicita.ec |
| Recepcionista | recepcion@medicita.ec |
| Médico | dra.mendoza@medicita.ec / dr.cedeno@medicita.ec |
| Paciente | paciente1@correo.com / paciente2@correo.com |

Un paciente nuevo puede crear su cuenta desde la pantalla de registro.

## Qué hace cada rol

| Rol | Opciones | Requisitos |
| --- | --- | --- |
| Paciente | Registrarse, reservar en 3 pasos, ver sus citas e historial, cancelar hasta 24 horas antes, confirmar desde el correo | RF01, RF03, RF04, RF06, RF12, RF14 |
| Recepcionista | Ver las citas del día, agendar a pacientes que llaman o llegan, registrar pacientes nuevos, reprogramar y cancelar, ver el historial de cada cita | RF07 |
| Médico | Ver su agenda del día y registrar si el paciente fue atendido, observaciones y si necesita control | RF10, RF13 |
| Administrador | Especialidades, médicos, horarios semanales, resumen mensual y recordatorios enviados | RF08, RF09, RF11, RF15 |

En todos los casos:

- **RF05:** el sistema no deja guardar dos citas con el mismo médico, fecha y hora. Lo impide el índice único de la base de datos, aunque dos personas reserven al mismo tiempo.
- **RNF01:** las contraseñas se guardan cifradas con bcrypt y cada usuario solo ve lo de su rol.
- **RNF02:** la sesión se cierra después de 30 minutos sin actividad.
- **RNF05:** las pantallas se adaptan al celular.
- **RNF08:** no se puede crear la cuenta sin aceptar el uso de los datos personales.

## Seguridad

| Riesgo | Cómo se protege |
| --- | --- |
| Entrar por la URL a opciones de otro rol | El backend revisa el token y el rol en **cada** petición. Si un paciente escribe `/admin/reportes` en el navegador, la pantalla lo regresa a su inicio y la API responde 403 "No tienes permiso". |
| Ver datos de otro paciente cambiando el número de la cita | Antes de devolver una cita se comprueba que sea del paciente (o del médico) que inició sesión. |
| Alterar el token para hacerse administrador | El token va firmado con `JWT_SECRET`. Si se cambia una sola letra, la firma deja de coincidir y se rechaza. |
| Inyección SQL | Todas las consultas usan parámetros (`$1`, `$2`), nunca texto pegado. Además, fechas, números y estados se validan antes de consultar. |
| Contraseñas robadas de la base | Se guardan cifradas con bcrypt (no se pueden descifrar, solo comparar). |
| Probar contraseñas sin parar | Máximo 10 intentos de inicio de sesión por minuto desde la misma conexión. |
| Sesión abierta en una computadora compartida | Se cierra sola tras 30 minutos sin actividad (RNF02). |
| Código malicioso en los nombres | Nombres y apellidos solo aceptan letras; además se escapan al ponerlos en el correo. |
| Otras páginas usando la API | Solo la dirección del frontend (`FRONTEND_URL`) puede llamarla desde el navegador. Se agregan encabezados de seguridad con `helmet`. |
| Claves en GitHub | Contraseñas y claves van en `.env`, que no se sube al repositorio. |

Para comprobarlo, con el backend encendido, en la carpeta `backend` ejecutar:

```
node pruebas/seguridad.mjs
```

Hace 90 pruebas: entra con cada rol a las opciones de los demás, intenta ver y cancelar citas ajenas, altera el token y prueba inyecciones SQL. El resultado esperado es "90 pruebas pasaron, 0 fallaron" (el último resultado está en `docs/resultado_pruebas_seguridad.txt`). Si se ejecuta dos veces seguidas, hay que esperar un minuto por el límite de intentos de inicio de sesión.

Cuando el sistema se publique en un servidor, debe usarse con **HTTPS** para que los datos viajen cifrados.

## Accesibilidad

El sistema sigue las pautas **WCAG 2.1 nivel AA**. En todas las pantallas hay un botón **Accesibilidad** (abajo a la derecha) con estas opciones, que se guardan en el navegador de cada persona:

| Opción | Para quién |
| --- | --- |
| Letra normal, grande o muy grande | Personas con baja visión y adultos mayores |
| Alto contraste (negro sobre blanco, bordes gruesos) | Baja visión y daltonismo |
| Reducir movimiento | Personas con epilepsia fotosensible, mareos o problemas de atención |
| Avisos por voz: lee en voz alta los mensajes del sistema | Personas ciegas o con baja visión que no usan lector de pantalla, o con dificultad para leer |
| Vibración en el celular al confirmar o cuando hay un error | Personas sordas o con baja audición |

**Retroalimentación.** Cada acción importante avisa por varios medios a la vez: el mensaje en pantalla, el lector de pantalla, la voz y la vibración (estas dos si están activadas). Por ejemplo, al reservar se escucha *"Cita reservada para el lunes 26 de octubre a las 10:00 con Luis Cedeño"*. Los errores se anuncian de inmediato y los demás mensajes sin interrumpir.

**Además:**
- **Teclado:** todo se puede usar solo con el teclado (Tab, Enter, Escape). Hay un enlace "Saltar al contenido principal" y el foco se ve con un borde grueso.
- **Lectores de pantalla** (NVDA, JAWS, TalkBack, VoiceOver):
  - Los horarios se leen como "08:20, libre" u "08:40, ocupado".
  - Los pasos de la reserva dicen en cuál estás.
  - Los botones de las tablas dicen a qué paciente afectan.
- **Ventanas:** el foco queda dentro de la ventana abierta, Escape la cierra y el foco vuelve al botón que la abrió.
- **Aviso de sesión:** 2 minutos antes de cerrarla por inactividad (RNF02) aparece un aviso con el botón **Seguir conectado**, para quien necesita más tiempo.
- **Contraste:** todos los textos tienen al menos 4,5:1. Los estados de las citas tienen texto, no solo color, y los horarios ocupados aparecen tachados.
- **Celular:** botones de al menos 44 px en pantallas táctiles.
- **Correo de recordatorio:** también va en texto simple, que leen mejor los lectores de pantalla.

La revisión automática con axe-core no encontró fallas en ninguna pantalla. El detalle está en `docs/resultado_pruebas_accesibilidad.txt`.

## Recordatorios por correo (RF11 y RF12)

Cada 15 minutos el backend busca las citas pendientes que empiezan en las próximas 24 horas y envía el correo con el enlace para confirmar. El administrador también puede enviarlos al momento desde **Resumen mensual > Enviar pendientes ahora**.

Si en `.env` no se configura el correo (`SMTP_HOST` vacío), el sistema no envía nada pero muestra en la terminal del backend el enlace de confirmación, para poder probarlo. Para enviar correos reales con Gmail:

1. Activar la verificación en dos pasos en la cuenta de Google.
2. Crear una **contraseña de aplicación** en myaccount.google.com > Seguridad.
3. En `.env` poner `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=` el correo y `SMTP_PASS=` esa contraseña.

El envío por WhatsApp (RF16) es opcional: se activa al poner `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID` de la API de WhatsApp Cloud de Meta.

## Copia de seguridad (RNF07)

Ejecutar una vez por semana `database/copia_de_seguridad.bat` (Windows) o `database/copia_de_seguridad.sh` (Linux o Mac). Las copias quedan en la carpeta `respaldos`.

## Plan de trabajo

El proyecto dura 55 días hábiles, del 8 de octubre al 23 de diciembre de 2026, de lunes a viernes. El desarrollo se hace con Scrum en 4 sprints de 2 semanas:

| Sprint | Qué se construye |
| --- | --- |
| 1 | Inicio de sesión, registro, especialidades y horarios |
| 2 | Disponibilidad, reservas, cancelaciones y agenda de recepción |
| 3 | Seguimiento de la atención, agenda del médico y recordatorios |
| 4 | Historial de citas, resumen mensual y WhatsApp |

El seguimiento de tareas se lleva en Trello y el cronograma en ProjectLibre (`docs/cronograma`).
