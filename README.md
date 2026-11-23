# AudiVare

Plataforma documental multiempresa desarrollada por Renzo Paull Castañeda Cabanillas. El producto organiza documentos por empresa y periodo, con perfiles internos, contadores vinculados, permisos e historial de cambios.

## Recorrido recomendado del código

1. [API y módulos de negocio](apps/api/src): controladores NestJS, servicios y validaciones.
2. [Documentos mensuales](apps/api/src/documentos-mensuales): carga, edición, permisos y organización por periodo.
3. [Autenticación](apps/api/src/auth) y [permisos](apps/api/src/common/permisos): verificación del usuario y autorización del lado del servidor.
4. [Interfaz web](apps/web/src/app): rutas Next.js, formularios y pantallas de empresa y contador.
5. [Modelo de datos](packages/database/src/schema): tablas, relaciones y restricciones con Drizzle.
6. [Pruebas de la API](apps/api/test): ejemplos del enfoque de validación y casos de regresión. Se conservan pruebas de flujos históricos; su presencia no significa que todos esos flujos sigan activos.

Para seguir una funcionalidad completa, empieza en documentos mensuales, revisa su controlador y servicio, consulta el esquema y después las pantallas correspondientes de la web. El backend verifica empresa, permisos y vínculo del contador; la interfaz no es la única barrera de acceso.

## Herramientas y estructura

Monorepo TypeScript: `apps/api` contiene NestJS/Fastify; `apps/web`, Next.js/React; `packages/database`, PostgreSQL/Drizzle. Los manifiestos `package.json` y el archivo de bloqueo conservan las versiones del proyecto. Almacenamiento compatible con S3 y enlaces firmados.

Se mantienen componentes históricos para mostrar el código existente. No se presenta la antigua importación Excel/SUNAT como una función vigente del producto.

## Alcance de esta copia

Código del proyecto preparado para revisión técnica. Se conserva la estructura y la lógica del trabajo original; se retiraron credenciales, datos de contacto privados, archivos de operación e historial Git. No se incluye una base de datos con información real ni un entorno de producción. Esta entrega permite leer el código; no certifica un despliegue ni ejecución completa.

Las variables necesarias están enumeradas, sin valores, en [`.env.example`](.env.example). Los secretos se definen fuera del repositorio. Las variables con prefijo `NEXT_PUBLIC_` o `VITE_` son visibles en el navegador y no deben contener contraseñas ni claves privadas. Las cadenas ficticias de pruebas y desarrollo están identificadas como tales y no son credenciales de producción.

La ausencia de una licencia de código abierto no concede permiso general para reutilizar el producto. Esta copia conserva las atribuciones existentes; la publicación y una licencia de reutilización se deciden por separado.
