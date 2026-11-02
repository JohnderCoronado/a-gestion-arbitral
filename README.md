# A · Beta de demostración

Demostración pública para presentar el flujo de una asociación arbitral. Nombres, correos, torneos, partidos y montos son ficticios. No representa ni está afiliada a una asociación, liga o federación real.

**Abrir beta:** https://a-gestion-beta.cgpt415717.chatgpt.site

**Repositorio privado:** https://github.com/JohnderCoronado/a-gestion-arbitral

Se puede compartir el enlace sin iniciar sesión. Cada navegador mantiene su propia copia de los datos de demostración.

## Recorrido sugerido

1. Entre como Administrador. Revise el resumen y abra Partidos.
2. Abra Asignar árbitros. El selector muestra los integrantes del torneo y descarta conflictos o falta de disponibilidad.
3. Invite a una persona disponible. Cambie a su perfil usando el selector superior.
4. En Mis nombramientos, acepte o rechace. Al aceptar, aparecen horario, honorarios y los enlaces a Google Maps y Waze.
5. En Mi disponibilidad, marque días y rangos horarios. Guarde la semana.
6. Vuelva al Administrador. Cree un torneo, seleccione su panel y registre un partido.
7. En Cobros y pagos, marque un cobro o un pago de ejemplo. El árbitro verá el pago en Mis pagos.
8. Exporte el registro a CSV si desea revisarlo en una hoja de cálculo.

El botón Restablecer demostración devuelve los datos iniciales. En celular aparece como un icono de flecha circular junto a la marca.

## Reglas de la beta

- La disponibilidad debe cubrir el bloque completo del partido.
- Invitaciones pendientes y aceptadas reservan el horario.
- Se exige un margen provisional de 45 minutos entre partidos del mismo día. No calcula rutas ni tiempos reales de viaje.
- Los candidatos disponibles se ordenan por cantidad total de nombramientos activos. La categoría es informativa; el administrador decide.
- Un rechazo libera al árbitro y permite invitar a un reemplazo.
- Solo los nombramientos aceptados generan honorarios en el registro.
- Cambiar disponibilidad no cancela partidos confirmados. Una invitación pendiente se vuelve a validar al aceptarla.
- Las coordenadas son opcionales. Sin ellas se abre una búsqueda por nombre de cancha.

## Límites antes de un piloto con usuarios reales

El selector de perfiles simula los papeles de administrador y árbitro. No hay autenticación individual ni control de permisos en un servidor. Cualquier visitante de esta beta pública puede probar ambos perfiles con los datos ficticios de su navegador.

Los datos se guardan en localStorage de cada navegador. No se sincronizan entre dispositivos ni entre usuarios. No hay base de datos compartida, respaldos externos, correos automáticos, transferencias bancarias ni facturación electrónica. No ingresar información real de clientes en esta demostración.

El portal de organizadores, la administración de jugadores y las sanciones quedan fuera de esta versión. La beta tampoco implementa reprogramaciones, cancelaciones de partidos confirmados o liquidaciones contables definitivas.

Para un piloto operativo: definir reglas con la asociación, implementar cuentas reales y permisos de servidor, base de datos compartida, respaldos y restauración, registro de cambios, recuperación de acceso, notificaciones y pruebas independientes de seguridad.

## Desarrollo

Aplicación estática con HTML, CSS y módulos JavaScript. Sin dependencias de ejecución; las fuentes web tienen alternativas locales. Esto permite validar la experiencia sin decidir todavía la infraestructura de la aplicación comercial.

### Ejecutar en su computadora

Desde la carpeta del proyecto, con Python 3 instalado:

```sh
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Abra http://127.0.0.1:4173 en el navegador. No necesita instalar dependencias. Para detener el servidor, presione Ctrl+C.

### Comprobar las reglas

Con Node.js instalado:

```sh
node check-domain.mjs
```

También puede ejecutar `npm run check` para comprobar la sintaxis y las reglas. Se incluyen 12 comprobaciones de disponibilidad, pertenencia a torneos, cruces, traslados, aceptación, rechazo y cálculo de honorarios.

### Estructura

- `dist/index.html`: página de entrada.
- `dist/app.mjs`: pantallas y recorridos de la demostración.
- `dist/domain.mjs`: reglas de nombramientos y cuentas.
- `dist/demo-labels.mjs`: actualización de nombres ficticios antiguos.
- `dist/styles.css`: diseño adaptable a computadora y celular.
- `dist/favicon.svg`: icono A.
- `check-domain.mjs`: comprobaciones de las reglas.
- `.openai/hosting.json`: asociación con el alojamiento actual; no contiene credenciales.

Los archivos de `dist/` son el código editable de esta beta y deben guardarse en Git. No hay paso de compilación. El repositorio guarda el código; los cambios locales de los visitantes permanecen en sus respectivos navegadores.

## Primeros pasos con GitHub

- **Code** muestra los archivos del proyecto. Este README es su guía de entrada.
- **Commit** es una versión guardada del código con una descripción del cambio. El historial permite comparar versiones y recuperar una anterior.
- **main** es la rama principal del proyecto.
- **Issues** sirve para anotar errores o ideas de funciones. Evite incluir datos personales reales.
- **Pull request** permite revisar un grupo de cambios antes de incorporarlo a la rama principal.

Este repositorio es privado y la beta de demostración es pública. Guardar un cambio en GitHub no actualiza automáticamente la beta: después de comprobarlo se debe publicar la nueva versión en el alojamiento.
