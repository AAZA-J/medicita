-- =====================================================================
-- MediCita: sistema de gestión de citas y atención para un centro médico
-- Script de creación de la base de datos en PostgreSQL
-- Proyecto Final, Gestión de Proyectos de Software, ULEAM 2026-2
-- =====================================================================
-- Cómo usarlo en pgAdmin:
--   1. Crear la base de datos "medicita" (clic derecho en Databases > Create > Database).
--   2. Clic derecho sobre "medicita" > Query Tool.
--   3. Abrir este archivo (icono de carpeta) o pegar todo el texto.
--   4. Ejecutar con F5.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Usuarios y personas
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
    id_usuario       SERIAL PRIMARY KEY,
    correo           VARCHAR(120) NOT NULL UNIQUE,
    contrasena_hash  VARCHAR(255) NOT NULL,
    rol              VARCHAR(20)  NOT NULL
                     CHECK (rol IN ('paciente', 'recepcionista', 'medico', 'administrador')),
    activo           BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en        TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE pacientes (
    id_paciente      SERIAL PRIMARY KEY,
    id_usuario       INT UNIQUE REFERENCES usuarios (id_usuario),
    cedula           VARCHAR(10)  NOT NULL UNIQUE CHECK (cedula ~ '^[0-9]{10}$'),
    nombres          VARCHAR(80)  NOT NULL,
    apellidos        VARCHAR(80)  NOT NULL,
    celular          VARCHAR(10)  NOT NULL CHECK (celular ~ '^09[0-9]{8}$'),
    acepta_datos     BOOLEAN      NOT NULL CHECK (acepta_datos = TRUE),   -- RNF08
    fecha_aceptacion TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE medicos (
    id_medico        SERIAL PRIMARY KEY,
    id_usuario       INT NOT NULL UNIQUE REFERENCES usuarios (id_usuario),
    nombres          VARCHAR(80)  NOT NULL,
    apellidos        VARCHAR(80)  NOT NULL,
    activo           BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------
-- 2. Especialidades y horarios (RF08, RF09)
-- ---------------------------------------------------------------------
CREATE TABLE especialidades (
    id_especialidad  SERIAL PRIMARY KEY,
    nombre           VARCHAR(60)  NOT NULL UNIQUE,
    descripcion      VARCHAR(200),
    activa           BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE medico_especialidad (
    id_medico        INT NOT NULL REFERENCES medicos (id_medico),
    id_especialidad  INT NOT NULL REFERENCES especialidades (id_especialidad),
    PRIMARY KEY (id_medico, id_especialidad)
);

CREATE TABLE horarios (
    id_horario       SERIAL PRIMARY KEY,
    id_medico        INT      NOT NULL REFERENCES medicos (id_medico),
    dia_semana       SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 6),  -- 1 lunes ... 6 sábado
    hora_inicio      TIME     NOT NULL,
    hora_fin         TIME     NOT NULL,
    duracion_min     SMALLINT NOT NULL CHECK (duracion_min BETWEEN 10 AND 120),
    CHECK (hora_fin > hora_inicio)
);

-- ---------------------------------------------------------------------
-- 3. Citas (RF04, RF05, RF06, RF07, RF12)
-- ---------------------------------------------------------------------
CREATE TABLE citas (
    id_cita          SERIAL PRIMARY KEY,
    id_paciente      INT  NOT NULL REFERENCES pacientes (id_paciente),
    id_medico        INT  NOT NULL REFERENCES medicos (id_medico),
    id_especialidad  INT  NOT NULL REFERENCES especialidades (id_especialidad),
    fecha            DATE NOT NULL,
    hora             TIME NOT NULL,
    estado           VARCHAR(15) NOT NULL DEFAULT 'Pendiente'
                     CHECK (estado IN ('Pendiente', 'Confirmada', 'Cancelada', 'Atendida', 'No asistió')),
    creada_por       INT  NOT NULL REFERENCES usuarios (id_usuario),
    creada_en        TIMESTAMP NOT NULL DEFAULT NOW(),
    cancelada_en     TIMESTAMP
);

-- RF05: no puede haber dos citas activas con el mismo médico, fecha y hora.
-- Las citas canceladas no ocupan el turno (RF06).
CREATE UNIQUE INDEX cita_unica
    ON citas (id_medico, fecha, hora)
    WHERE estado <> 'Cancelada';

-- ---------------------------------------------------------------------
-- 4. Seguimiento, recordatorios e historial (RF10, RF11, RF14, RF16)
-- ---------------------------------------------------------------------
CREATE TABLE atenciones (
    id_atencion      SERIAL PRIMARY KEY,
    id_cita          INT NOT NULL UNIQUE REFERENCES citas (id_cita),
    asistio          BOOLEAN   NOT NULL,
    observaciones    TEXT,
    requiere_control BOOLEAN   NOT NULL DEFAULT FALSE,
    registrada_en    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE recordatorios (
    id_recordatorio    SERIAL PRIMARY KEY,
    id_cita            INT NOT NULL REFERENCES citas (id_cita),
    canal              VARCHAR(10) NOT NULL CHECK (canal IN ('correo', 'whatsapp')),
    estado             VARCHAR(10) NOT NULL CHECK (estado IN ('enviado', 'fallido')),
    enviado_en         TIMESTAMP,
    token_confirmacion VARCHAR(64) NOT NULL UNIQUE
);

CREATE TABLE historial_citas (
    id_historial     SERIAL PRIMARY KEY,
    id_cita          INT NOT NULL REFERENCES citas (id_cita),
    estado_anterior  VARCHAR(15),
    estado_nuevo     VARCHAR(15) NOT NULL,
    fecha_anterior   DATE,
    hora_anterior    TIME,
    cambiado_por     INT NOT NULL REFERENCES usuarios (id_usuario),
    motivo           VARCHAR(200),
    cambiado_en      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para las búsquedas más frecuentes (RNF03)
CREATE INDEX idx_citas_paciente ON citas (id_paciente);
CREATE INDEX idx_citas_fecha    ON citas (fecha);
CREATE INDEX idx_horarios_medico ON horarios (id_medico);
CREATE INDEX idx_historial_cita ON historial_citas (id_cita);

-- =====================================================================
-- 5. Datos de prueba (inventados, solo para probar el sistema)
-- =====================================================================
-- La contraseña de todos los usuarios de prueba es "Prueba123".
-- El valor guardado es el hash bcrypt de esa contraseña, como pide RNF01.
INSERT INTO usuarios (correo, contrasena_hash, rol) VALUES
('admin@medicita.ec',     '$2b$10$ETfjztZKe2M2918ckqBqBeVibfvWskTr8wYoWZ9ipMrE1CEUTGQqa', 'administrador'),
('recepcion@medicita.ec', '$2b$10$ETfjztZKe2M2918ckqBqBeVibfvWskTr8wYoWZ9ipMrE1CEUTGQqa', 'recepcionista'),
('dra.mendoza@medicita.ec','$2b$10$ETfjztZKe2M2918ckqBqBeVibfvWskTr8wYoWZ9ipMrE1CEUTGQqa', 'medico'),
('dr.cedeno@medicita.ec', '$2b$10$ETfjztZKe2M2918ckqBqBeVibfvWskTr8wYoWZ9ipMrE1CEUTGQqa', 'medico'),
('paciente1@correo.com',  '$2b$10$ETfjztZKe2M2918ckqBqBeVibfvWskTr8wYoWZ9ipMrE1CEUTGQqa', 'paciente'),
('paciente2@correo.com',  '$2b$10$ETfjztZKe2M2918ckqBqBeVibfvWskTr8wYoWZ9ipMrE1CEUTGQqa', 'paciente');

INSERT INTO medicos (id_usuario, nombres, apellidos) VALUES
(3, 'Andrea', 'Mendoza'),
(4, 'Luis',   'Cedeño');

INSERT INTO especialidades (nombre, descripcion) VALUES
('Medicina general', 'Consulta general para adultos y niños'),
('Pediatría',        'Atención a niños y adolescentes'),
('Ginecología',      'Salud de la mujer');

INSERT INTO medico_especialidad (id_medico, id_especialidad) VALUES
(1, 1), (1, 2),
(2, 1), (2, 3);

-- Lunes a viernes de 08:00 a 12:00, citas de 20 minutos
INSERT INTO horarios (id_medico, dia_semana, hora_inicio, hora_fin, duracion_min)
SELECT m, d, '08:00', '12:00', 20
FROM generate_series(1, 2) AS m, generate_series(1, 5) AS d;

INSERT INTO pacientes (id_usuario, cedula, nombres, apellidos, celular, acepta_datos) VALUES
(5,    '1312345678', 'María José', 'Vera Loor',      '0991234567', TRUE),
(6,    '1309876543', 'Carlos',     'Zambrano Mero',  '0987654321', TRUE),
(NULL, '1305556667', 'Rosa',       'Intriago Pinargote', '0981112233', TRUE);  -- registrada por recepción

INSERT INTO citas (id_paciente, id_medico, id_especialidad, fecha, hora, estado, creada_por) VALUES
(1, 1, 2, '2026-11-03', '08:00', 'Confirmada', 5),
(2, 2, 1, '2026-11-03', '08:20', 'Pendiente',  6),
(3, 1, 1, '2026-11-04', '09:00', 'Pendiente',  2);

INSERT INTO historial_citas (id_cita, estado_anterior, estado_nuevo, cambiado_por, motivo) VALUES
(1, NULL,        'Pendiente',  5, 'Reserva en línea'),
(1, 'Pendiente', 'Confirmada', 5, 'Confirmó desde el correo'),
(2, NULL,        'Pendiente',  6, 'Reserva en línea'),
(3, NULL,        'Pendiente',  2, 'Agendada por teléfono');

-- =====================================================================
-- 6. Consultas para comprobar que todo funciona
-- =====================================================================
-- Citas con nombres de paciente, médico y especialidad
SELECT c.id_cita, c.fecha, c.hora, c.estado,
       p.nombres || ' ' || p.apellidos AS paciente,
       m.nombres || ' ' || m.apellidos AS medico,
       e.nombre AS especialidad
FROM citas c
JOIN pacientes p      ON p.id_paciente = c.id_paciente
JOIN medicos m        ON m.id_medico = c.id_medico
JOIN especialidades e ON e.id_especialidad = c.id_especialidad
ORDER BY c.fecha, c.hora;

-- Prueba del RF05 (debe dar error de clave duplicada si se quita el comentario):
-- INSERT INTO citas (id_paciente, id_medico, id_especialidad, fecha, hora, creada_por)
-- VALUES (2, 1, 2, '2026-11-03', '08:00', 6);
