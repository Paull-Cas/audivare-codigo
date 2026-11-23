// Mensaje de estado vacío consistente para listas y tablas.

export default function EmptyState({ mensaje }: { mensaje: string }) {
  return (
    <div className="text-center py-10 text-gray-500 font-medium">{mensaje}</div>
  );
}
