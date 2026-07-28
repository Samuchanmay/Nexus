import { EmptyState } from "@/components/shared";
import { Icon } from "@/components/os/icons";

// Estado por defecto del panel derecho en escritorio cuando no hay ninguna
// conversación abierta (la lista, a la izquierda, vive en el layout — ver
// chat/layout.tsx). En celular este panel nunca se ve: ChatShell lo oculta
// y muestra solo la lista en su lugar.
export default function ChatRootPage() {
  return (
    <div className="h-full flex items-center justify-center">
      <EmptyState
        icon={<Icon name="message" size={26} />}
        title="Selecciona una conversación"
        hint="Elige un chat de la lista o escribe a alguien nuevo para empezar."
      />
    </div>
  );
}
