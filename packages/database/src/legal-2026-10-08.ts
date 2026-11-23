// Módulo público independiente: no importar BD, secretos ni módulos de servidor aquí.
export const RESPONSABLE_AUDIVARE = {
  nombre: 'Responsable de ejemplo',
  domicilio: 'Domicilio omitido en copia de código',
  correo: 'contacto@example.invalid',
} as const;

export type DocumentoLegal = {
  titulo: string;
  version: string;
  fecha: string;
  secciones: readonly { titulo: string; parrafos: readonly string[] }[];
};

export const TERMINOS_AUDIVARE: DocumentoLegal = {
  titulo: 'Términos de uso de AudiVare',
  version: '2026-10-08.1',
  fecha: '8 de octubre de 2026',
  secciones: [
    { titulo: '1. Servicio y responsable', parrafos: [
      'AudiVare es un servicio de organización documental contable para empresas y contadores en Perú, prestado por la persona natural identificada en esta página. Permite importar información de facturas, adjuntar documentación, registrar pagos y compartir información con usuarios autorizados.',
      'La aplicación no emite comprobantes electrónicos, no ejecuta pagos bancarios ni se conecta automáticamente con SUNAT. La revisión contable y tributaria corresponde a la empresa y a los profesionales que esta designe.',
    ] },
    { titulo: '2. Cuentas y acceso a empresas', parrafos: [
      'Quien registra o representa a una empresa debe estar autorizado para hacerlo. Debe proporcionar información correcta, proteger sus cuentas y revisar los usuarios, permisos y vínculos de contadores. Cada usuario debe utilizar su propia cuenta y comunicar cualquier acceso que no reconozca.',
      'Un contador solo accede a las empresas que lo autoricen. El contador que utiliza AudiVare no se convierte por ello en operador del servicio ni obtiene acceso a todas las empresas.',
    ] },
    { titulo: '3. Prueba inicial y periodos habilitados', parrafos: [
      'Las empresas nuevas disponen de una prueba de 168 horas consecutivas desde su registro. No comienza de nuevo por incorporar usuarios ni incluye otra semana de gracia. Al finalizar, las funciones ordinarias se bloquean si no existe un periodo habilitado; se muestra el contacto para coordinar la continuidad.',
      'La contratación se acuerda individualmente por escrito antes del pago, indicando importe, moneda, periodo, usuarios incluidos, límites y fechas de inicio y fin. No existe renovación ni cobro automático. No se publica un catálogo de precios mientras no haya sido definido.',
      'El registro de pagos del servicio es manual. El sistema admite periodos de uno, tres, seis o doce meses calendario desde la fecha del pago registrado, con ajuste al último día del mes cuando corresponda y siete días de gracia para periodos pagados. Una renovación anticipada requiere acordar expresamente cómo se preserva el tiempo restante: el sistema no lo acumula automáticamente.',
      'Los periodos anuales ya contratados se respetan. Estas condiciones no reducen su duración ni convierten cuentas anteriores en pruebas nuevas. Una suspensión administrativa por seguridad o incumplimiento se evalúa separadamente de la vigencia del pago.',
    ] },
    { titulo: '4. Documentos, límites y uso permitido', parrafos: [
      'El contenido sigue perteneciendo a sus titulares. El cliente autoriza únicamente el tratamiento necesario para prestar el servicio y debe contar con legitimidad para incorporar datos de terceros y compartirlos con sus usuarios o contador.',
      'Los adjuntos admitidos son PDF, PNG y JPEG, con un máximo de 10 MiB por archivo. El registro inicial admite dos usuarios internos, incluido el administrador; los vínculos internos desactivados también cuentan para ese límite. Cualquier ampliación y capacidad contratada debe constar en la oferta individual.',
      'No cargues contraseñas, claves privadas, credenciales bancarias ni información ajena a la finalidad documental contable. Antes de incorporar datos de salud, biométricos, de menores u otra información especialmente delicada, consulta al responsable para revisar la necesidad y las medidas aplicables. Los datos económicos personales también requieren especial cuidado.',
      'Se prohíbe cargar código malicioso, intentar acceder a otras empresas, compartir accesos sin autorización o utilizar el servicio para actividades ilícitas. AudiVare puede restringir el acceso necesario para atender un riesgo concreto, informando el motivo cuando sea posible sin agravar el incidente.',
    ] },
    { titulo: '5. Atención, cancelación y devoluciones', parrafos: [
      'El canal de soporte, cancelación y reclamos comerciales es el correo indicado en esta página. Al solicitar cancelación se verificará la representación y se comunicará por escrito la fecha efectiva de cierre y el procedimiento de entrega. Dejar de utilizar la aplicación no constituye por sí solo una solicitud de eliminación.',
      'Cancelar una futura renovación no supone un cobro nuevo ni reduce por sí solo el periodo ya pagado. Si se pide un cierre anticipado, se revisarán los acuerdos existentes, los importes y servicios efectivamente prestados y los derechos aplicables. Los errores de cobro o incumplimientos se atenderán según el caso; no se establece una exclusión general de devoluciones o de responsabilidad.',
    ] },
    { titulo: '6. Entrega, conservación y eliminación', parrafos: [
      'El cierre efectivo se comunicará al representante autorizado. Desde esa fecha dispone de 30 días calendario para solicitar la entrega de los datos y archivos de su empresa. La solicitud se recibe por correo o mediante el formulario de datos, aunque la cuenta no tenga acceso vigente. Se verifica identidad, representación y alcance antes de acordar un medio seguro de entrega.',
      'Los documentos se conservarán durante 90 días calendario desde el cierre efectivo comunicado. El vencimiento de la prueba o del periodo de acceso no ejecuta un borrado inmediato ni sustituye esa comunicación. Transcurridos los 90 días, el responsable realizará la eliminación manual verificada, incluyendo referencias, archivos y copias históricas bajo su control, salvo una obligación concreta de conservación o una solicitud pendiente que justifique una retención limitada.',
      'El plazo comercial de 30 días no impide ejercer derechos sobre datos personales ni presentar una solicitud mientras exista información conservada. La entrega asistida no habilita por sí sola las operaciones ordinarias de una cuenta vencida. Los registros necesarios para seguridad, atención, obligaciones legales o controversias se tratan por separado, con finalidad y acceso limitados.',
    ] },
    { titulo: '7. Seguridad y continuidad', parrafos: [
      'Se aplican controles de acceso por empresa, sesiones limitadas, validación básica de archivos y almacenamiento privado. Estos controles reducen riesgos, pero no garantizan ausencia de incidentes ni disponibilidad ininterrumpida.',
      'En esta etapa no se ofrece análisis antivirus de adjuntos ni un servicio de respaldo periódico o recuperación garantizada. El cliente debe conservar sus documentos originales. Esta información no elimina las obligaciones de seguridad del prestador ni los derechos que correspondan al cliente.',
    ] },
    { titulo: '8. Cambios, privacidad y controversias', parrafos: [
      'La política de privacidad explica el tratamiento de cuentas y documentos. Las instrucciones sobre información de la empresa deben ser impartidas por un representante autorizado. El uso para finalidades distintas requiere su propia justificación y, cuando corresponda, autorización.',
      'Las modificaciones relevantes se comunicarán al correo de la cuenta antes de su aplicación. Los cambios de precio, duración o alcance contratado requieren acuerdo; no se presume aceptación retroactiva ni se reducen anualidades pagadas por publicar esta página.',
      'Puedes comunicar una controversia al responsable sin renunciar a acudir a las autoridades competentes en Perú. Estos términos no limitan derechos legalmente irrenunciables. La publicación o lectura de esta página, por sí sola, no constituye un registro de aceptación contractual.',
    ] },
  ],
};

export const PRIVACIDAD_AUDIVARE: DocumentoLegal = {
  titulo: 'Política de privacidad de AudiVare',
  version: '2026-10-08.1',
  fecha: '8 de octubre de 2026',
  secciones: [
    { titulo: '1. Responsable y alcance', parrafos: [
      'La persona natural identificada en esta página administra AudiVare y atiende las consultas sobre datos personales. Para la gestión de cuentas, contratación, seguridad y atención decide las finalidades del tratamiento. Para la documentación que una empresa incorpora, presta el servicio siguiendo sus instrucciones; la empresa debe justificar su tratamiento e informar a las personas afectadas.',
      'El contador vinculado recibe los accesos que la empresa autorice y debe cumplir sus propias obligaciones sobre los datos que utiliza. No se convierte por ese vínculo en responsable de la operación de AudiVare.',
    ] },
    { titulo: '2. Datos y finalidades', parrafos: [
      'Para identificarte y gestionar tu cuenta se utiliza el nombre, correo verificado, tipo de usuario y fechas de registro. El registro de empresa requiere RUC y razón social; se mantienen vínculos, permisos e invitaciones para organizar el acceso. El avatar de perfil es opcional. Sin los datos obligatorios no es posible completar el registro o prestar la función correspondiente.',
      'Para gestionar el servicio se registran periodos habilitados, monto y fecha del pago comunicado y el administrador que lo registra. AudiVare no solicita ni almacena números de tarjeta para realizar cobros. Las condiciones económicas se acuerdan por separado.',
      'El cliente puede incorporar facturas, comprobantes, documentos generales, pagos contables, observaciones y mensajes. Estos pueden incluir nombres, RUC de personas naturales, firmas, información económica u otros datos personales. Se utilizan para organizar, consultar, compartir y entregar la documentación según los permisos e instrucciones de la empresa.',
      'Para seguridad y diagnóstico se procesan sesiones, identificadores de usuario y recursos, fechas, rutas de operación, resultado y duración. La dirección IP se procesa para limitar solicitudes; los proveedores de infraestructura también pueden generar sus registros técnicos. Los registros propios no están destinados a almacenar contraseñas, tokens ni el contenido de los archivos.',
      'El formulario de datos recibe tipo de solicitud, correo y descripción para atenderla, verificar identidad cuando corresponda y dejar constancia de las actuaciones. No adjuntes documentos de identidad, contraseñas ni información innecesaria de terceros.',
    ] },
    { titulo: '3. Fundamento y usos adicionales', parrafos: [
      'Los datos necesarios para preparar o ejecutar la relación de servicio se tratan para esa relación y para las obligaciones legales aplicables. El contenido de empresa se procesa conforme a instrucciones lícitas de su responsable. Cuando un tratamiento requiera consentimiento, este debe obtenerse de forma específica y separada; no se presume por disponer de una cuenta.',
      'AudiVare no utiliza el contenido del cliente para publicidad ni para entrenar modelos de inteligencia artificial como parte del servicio descrito. Incorporar una finalidad distinta requiere información previa y el fundamento que corresponda. El cliente debe contar con legitimidad y, cuando resulte exigible, consentimiento para los datos personales y sensibles que incorpore.',
    ] },
    { titulo: '4. Accesos, proveedores y tratamiento fuera de Perú', parrafos: [
      'La documentación puede ser consultada por los usuarios y contadores autorizados de la empresa según sus permisos. El administrador del servicio puede realizar accesos técnicos necesarios para soporte, seguridad o atención de una instrucción verificada; disponer de capacidad técnica no autoriza un uso personal de los documentos.',
      'Vercel presta la interfaz web y el procesamiento de sus rutas; Railway aloja el servidor y PostgreSQL; Cloudflare R2 almacena los archivos privados; Google proporciona la identificación para el inicio de sesión. El acceso mediante Google se utiliza para verificar identidad y correo, no para leer Gmail o Drive.',
      'La infraestructura comprende servicios fuera de Perú: la configuración inventariada incluye regiones de Estados Unidos para web y servidor y América del Norte oriental para archivos. Los servicios globales pueden utilizar otras ubicaciones para operación y soporte. No se ofrece residencia exclusiva en Perú. Puedes consultar por correo información sobre proveedores y tratamiento internacional; las garantías contractuales deben corresponder a los servicios efectivamente contratados.',
      'No se venden los datos del cliente. Una comunicación a una autoridad debe responder a un requerimiento válido o a una obligación aplicable, limitada a la información que corresponda.',
    ] },
    { titulo: '5. Conservación y salida', parrafos: [
      'Las cuentas y datos de empresa se mantienen mientras sean necesarios para la relación y sus accesos autorizados. Una sesión permite acceso durante un máximo de ocho horas; su expiración no significa que todos sus registros se borren en ese momento.',
      'Tras el cierre efectivo comunicado, se dispone de 30 días calendario para solicitar entrega de documentación y de 90 días de conservación de documentos. La eliminación posterior es manual y verificada; no se anuncia como una purga automática. La retención excepcional exige un motivo concreto, alcance limitado y revisión. Las copias históricas bajo control del responsable deben incluirse en la revisión para evitar reintroducir información eliminada.',
      'La trazabilidad de seguridad se conserva al menos dos años conforme a las obligaciones aplicables, con acceso restringido. Las solicitudes, datos de contratación y evidencias necesarias se conservan mientras sean necesarios para su atención y obligaciones o controversias identificadas; deben revisarse al cerrar cada caso y no conservarse indefinidamente por defecto. Los registros técnicos de proveedores tienen ciclos propios del servicio contratado.',
    ] },
    { titulo: '6. Derechos y contacto', parrafos: [
      'Puedes solicitar información y ejercer los derechos de acceso, rectificación, cancelación y oposición, así como los demás derechos que resulten aplicables, escribiendo al correo del responsable o usando el formulario de solicitudes sobre datos. El canal permanece disponible sin suscripción activa. Describe tu petición sin incorporar más datos de los necesarios.',
      'Se verificará tu identidad de manera proporcional y, para información empresarial, tu representación y el alcance autorizado. Si la petición se refiere a documentación tratada por cuenta de una empresa, se coordinará con su responsable. Una solicitud individual no autoriza entregar los documentos completos de otras personas o empresas.',
      'La atención respeta los plazos, requisitos y extensiones legalmente aplicables. Si una solicitud no puede ser atendida total o parcialmente, se comunicará su fundamento. Puedes acudir a la Autoridad Nacional de Protección de Datos Personales si consideras afectados tus derechos. El formulario de datos no sustituye el Libro de Reclamaciones cuando este resulte exigible.',
    ] },
    { titulo: '7. Cookies, almacenamiento del navegador y seguridad', parrafos: [
      'Se utiliza una cookie de sesión para autenticar el acceso y almacenamiento transitorio del navegador durante el registro. Las funciones descritas no incorporan cookies propias de publicidad. Los servicios de identificación e infraestructura pueden aplicar sus políticas de funcionamiento.',
      'Los archivos se guardan en un bucket privado y las descargas se autorizan según permisos y vigencia mediante enlaces de duración limitada. Se aplican controles de acceso y validación básica del formato y tamaño. Actualmente el análisis antivirus está deshabilitado y no se ofrece respaldo periódico ni recuperación garantizada. Ninguna de estas circunstancias exime al responsable de atender sus obligaciones de protección.',
      'Si detectas un acceso inesperado o una posible exposición, comunícalo por correo sin reenviar datos confidenciales. El responsable evaluará la contención y las comunicaciones que correspondan según la naturaleza del incidente.',
    ] },
    { titulo: '8. Actualizaciones', parrafos: [
      'La versión y fecha permiten identificar este texto. Los cambios relevantes se comunicarán al correo de la cuenta antes de su aplicación. Las finalidades nuevas y los consentimientos que se requieran no se consideran aceptados por la sola publicación de una actualización.',
    ] },
  ],
};
