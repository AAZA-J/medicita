# Cómo trabajamos en el repositorio

## Ramas

| Rama | Para qué sirve |
| --- | --- |
| `main` | Versión estable. Solo se actualiza al terminar cada sprint. |
| `develop` | Donde se une el trabajo del sprint en curso. |
| `feature/HU04-reservar-cita` | Una rama por cada historia de usuario. El nombre lleva el código de la historia. |

Nadie trabaja directo en `main` ni en `develop`.

## Paso a paso para una historia de usuario

1. Crear la rama desde `develop`: `feature/HU04-reservar-cita`.
2. Hacer los cambios y guardarlos con commits pequeños.
3. Abrir un **pull request** hacia `develop`.
4. Otra persona del equipo lo revisa. Widinson lo aprueba y lo une.
5. Mover la tarjeta en Trello a "En revisión" y luego a "Terminado".

## Mensajes de commit

Empezar con el tipo de cambio y decir qué se hizo:

- `feat: reserva de citas (HU04)`
- `fix: no permitir cancelar con menos de 24 horas (HU06)`
- `docs: actualiza el diccionario de datos`
- `db: agrega tabla historial_citas`

## Antes de pedir revisión

- Que el código funcione en tu computadora.
- Que cumpla los criterios de aceptación de la historia (sección 10 del informe).
- Que no tenga contraseñas ni datos personales reales.
