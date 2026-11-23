import Image from 'next/image';
import type { Metadata } from 'next';
import Link from 'next/link';
import { RESPONSABLE_AUDIVARE } from '@/config/legal';
import s from './landing.module.css';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: {
    title: 'AudiVare | Gestión documental para empresas y contadores',
    description: 'Facturas y sustentos organizados por mes para compartirlos con tu contador y descargarlos en un PDF de consulta.',
    url: 'https://audivare.com',
    siteName: 'AudiVare',
    locale: 'es_PE',
    type: 'website',
  },
};

const preguntas = [
  ['¿Puedo trabajar con mi contador externo?', 'Sí. Tu empresa puede invitar a su contador y vincularlo para trabajar sobre la misma documentación. Cada contador accede a las empresas a las que está vinculado.'],
  ['¿Qué documentos puedo adjuntar?', 'PDF, JPEG y PNG: facturas, medios de pago, guías de remisión del remitente o del transportista y otros documentos. Cada archivo puede tener hasta 10 MB.'],
  ['¿Los sustentos se vinculan a una factura?', 'No. Los documentos son independientes y se organizan por periodo y categoría. Puedes añadir una referencia en la nota; tu contador revisa a qué operación corresponde cada archivo.'],
  ['¿AudiVare importa Excel o descarga facturas de SUNAT?', 'No. Se cargan fotos o PDF de facturas y sustentos. No hay importación Excel ni conexión automática con SUNAT.'],
  ['¿Cómo funciona la prueba de siete días?', 'Las empresas nuevas disponen de siete días de acceso inicial. Para continuar después, debes coordinar la activación del servicio. Consulta las condiciones o escríbenos antes de empezar.'],
];
const funciones = [
  ['Carga sencilla', 'Elige el periodo, sube una foto o PDF y añade una referencia para identificar el documento.'],
  ['Tipos de sustento', 'Clasifica medios de pago, guías del remitente, guías del transportista y otros documentos.'],
  ['Organización mensual', 'Consulta los archivos por empresa, año, mes y categoría.'],
  ['Edición con historial', 'Corrige periodo o nota y consulta quién cargó, editó o eliminó documentos.'],
  ['Empresa y contador', 'Comparte el espacio documental con tus contadores vinculados.'],
  ['PDF por selección', 'Descarga las categorías de un periodo en un PDF combinado de consulta.'],
];
function Marca() {
  return <Link href="/" aria-label="AudiVare, inicio" className={s.marca}><Image src="/logo-audivare.png" alt="" width={44} height={44} /><Image src="/titulo-audivare.png" alt="AudiVare" width={146} height={37} /></Link>;
}

export default function Home() {
  return <div className={s.landing}>
    <a className={s.saltar} href="#contenido">Ir al contenido</a>
    <header className={s.header}><div className={s.nav}><Marca /><nav aria-label="Navegación principal"><a href="#como-funciona">Cómo funciona</a><a href="#funciones">Funciones</a><a href="#preguntas">Preguntas</a></nav><Link href="/login" className={s.ingresar}>Iniciar sesión ↗</Link></div></header>
    <main id="contenido">
      <section className={`${s.hero} ${s.ancho}`} aria-labelledby="titulo"><div><p className={s.etiqueta}>● Empresas y contadores · Perú</p><h1 id="titulo">Los documentos<br />de tu empresa,<br /><span>ordenados por mes.</span></h1><p className={s.intro}>Tu empresa y sus contadores, trabajando sobre la misma información. Carga facturas y sustentos, elige su año y mes y compártelos con tu contador desde un solo lugar.</p><div className={s.acciones}><Link href="/login" className={s.primario}>Comenzar prueba de 7 días →</Link><a href="#como-funciona">Conoce cómo funciona</a></div><p className={s.nota}>Para empresas nuevas · Acceso desde tu navegador</p></div>
        <div data-nosnippet className={s.ejemplo} aria-label="Ejemplo ilustrativo de documentos de un periodo"><div className={s.ejemploCabecera}><strong>AV</strong><span>Todo organizado por mes</span><span className={s.punto} /></div><div className={s.factura}><p className={s.micro}>OCTUBRE 2026 · EJEMPLO</p><h2>Documentos de octubre</h2><p>Facturas, medios de pago y documentos de sustento del periodo.</p><div className={s.sustentoTitulo}><h3>Archivos del periodo</h3><span>4 archivos</span></div>{['Factura original.pdf', 'Cotización.pdf', 'Guía de remisión.pdf', 'Constancia de pago.jpg'].map((nombre, i) => <div key={nombre} className={s.documento}><span className={s.documentoIcono} aria-hidden="true">{i === 3 ? 'JPG' : 'PDF'}</span><span>{nombre}</span><span className={s.check} aria-label="Adjunto">✓</span></div>)}<div className={s.compartido}><span className={s.avatar} aria-hidden="true">E</span><span className={s.avatarContador} aria-hidden="true">C</span><span>Empresa + contador<br /><strong>La misma documentación</strong></span></div></div><p className={s.ejemploNota}>Vista ilustrativa con datos de ejemplo.</p></div>
      </section>
      <section className={s.problema} aria-labelledby="problema-titulo"><div className={s.ancho}><p className={s.eyebrow}>UNA SITUACIÓN DEMASIADO CONOCIDA</p><h2 id="problema-titulo">«¿Dónde quedó el sustento<br />de esta factura?»</h2><p className={s.problemaIntro}>El contador necesita revisar una compra. Empiezan los mensajes,<br />las búsquedas y el «te lo envío en un momento».</p><div className={s.dispersos}>{[['01', 'En un correo', 'La factura'], ['02', 'En WhatsApp', 'La cotización'], ['03', 'En una carpeta', 'La guía de remisión'], ['04', 'Por encontrar', 'La constancia de pago']].map(([numero, lugar, documento]) => <div key={numero}><span>{numero}</span><p>{lugar}</p><h3>{documento}</h3></div>)}</div><div className={s.solucion}><span aria-hidden="true">↳</span><p>Con AudiVare, reúne los archivos por año, mes y tipo de documento para compartirlos con tus contadores vinculados.</p></div></div></section>
      <section id="como-funciona" className={`${s.seccion} ${s.ancho}`} aria-labelledby="pasos-titulo"><p className={s.eyebrow}>DEL DOCUMENTO SUELTO A LA INFORMACIÓN ORGANIZADA</p><h2 id="pasos-titulo">Un espacio compartido.<br />Tres pasos para empezar.</h2><div className={s.pasos}>{[['01', 'Registra la factura', 'Elige el año y mes, adjunta la foto o PDF y añade una nota si lo necesitas.'], ['02', 'Reúne el sustento', 'Carga medios de pago, guías de remisión y otros documentos en su periodo, sin llenar datos contables.'], ['03', 'Trabajen juntos', 'Consulta los archivos y descarga con tu contador un PDF de las categorías que elijan.']].map(([numero, titulo, texto]) => <article key={numero}><span>{numero}</span><h3>{titulo}</h3><p>{texto}</p></article>)}</div></section>
      <section className={s.perfiles} aria-labelledby="perfiles-titulo"><div className={s.ancho}><p className={s.eyebrow}>DOS PARTES. LA MISMA INFORMACIÓN.</p><h2 id="perfiles-titulo">Más orden para tu empresa.<br />Menos búsquedas para tu contador.</h2><div className={s.perfilesGrid}><article><p className={s.eyebrow}>PARA EMPRESAS</p><h3>El sustento de tus compras,<br />a mano.</h3><p>Organiza tu documentación y facilita su consulta a las personas autorizadas.</p><ul><li>Encuentra los documentos por año, mes y categoría.</li><li>Vincula a tus contadores externos.</li><li>Gestiona usuarios internos y permisos.</li></ul></article><article><p className={s.eyebrow}>PARA CONTADORES Y ESTUDIOS</p><h3>Revisa lo que necesitas,<br />desde un solo espacio.</h3><p>Trabaja con las empresas vinculadas y coordina la documentación pendiente.</p><ul><li>Consulta tus empresas vinculadas.</li><li>Elige el periodo y las categorías para consultar.</li><li>Descarga un PDF combinado para tu revisión.</li></ul></article></div></div></section>
      <section id="funciones" className={`${s.seccion} ${s.ancho}`} aria-labelledby="funciones-titulo"><p className={s.eyebrow}>HERRAMIENTAS PARA EL TRABAJO DIARIO</p><h2 id="funciones-titulo">La documentación en orden.<br />La revisión, más sencilla.</h2><div className={s.funciones}>{funciones.map(([titulo, texto], i) => <article key={titulo}><span aria-hidden="true">0{i + 1}</span><h3>{titulo}</h3><p>{texto}</p></article>)}</div></section>
      <section id="preguntas" className={`${s.preguntas} ${s.ancho}`} aria-labelledby="preguntas-titulo"><div><p className={s.eyebrow}>ANTES DE EMPEZAR</p><h2 id="preguntas-titulo">Resolvamos<br />tus dudas.</h2><p>Si necesitas orientación, <a href={`mailto:${RESPONSABLE_AUDIVARE.correo}`}>escríbenos</a>.</p></div><div className={s.acordeon}>{preguntas.map(([pregunta, respuesta]) => <details key={pregunta}><summary>{pregunta}<span aria-hidden="true">+</span></summary><p>{respuesta}</p></details>)}</div></section>
      <section className={`${s.cierre} ${s.ancho}`} aria-labelledby="cierre-titulo"><div><p className={s.eyebrow}>EMPIEZA CON LA PRÓXIMA FACTURA</p><h2 id="cierre-titulo">Organiza hoy la documentación<br />que necesitarás mañana.</h2><p>Un lugar para tu empresa, sus facturas y sus contadores.</p></div><Link href="/login" className={s.botonBlanco}>Comenzar prueba de 7 días →</Link></section>
    </main>
    <footer data-nosnippet className={`${s.footer} ${s.ancho}`}><div><Marca /><p>Gestión documental contable para empresas y contadores en Perú.</p><a href={`mailto:${RESPONSABLE_AUDIVARE.correo}`}>{RESPONSABLE_AUDIVARE.correo}</a></div><nav aria-label="Información legal"><Link href="/terminos">Términos de uso</Link><Link href="/politica-privacidad">Política de privacidad</Link><Link href="/privacidad">Solicitudes sobre datos</Link></nav><p className={s.footerNota}>AudiVare organiza la documentación aportada. La revisión contable y tributaria corresponde a los profesionales responsables.</p></footer>
  </div>;
}
