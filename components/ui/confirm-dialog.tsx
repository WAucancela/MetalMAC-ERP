/**
 * ConfirmDialog — reemplazo de `window.confirm()` para confirmaciones
 * destructivas o sensibles.
 *
 * `confirm()`/`alert()`/`prompt()` son síncronos y bloquean el hilo
 * principal: mientras el diálogo nativo está abierto, React no puede
 * pintar nada, y Chrome lo reporta como una interacción INP larga (el
 * tiempo que el usuario tarda en responder cuenta como "procesamiento"
 * del click). Este componente hace lo mismo pero de forma asíncrona,
 * sin bloquear el hilo principal.
 *
 * Uso:
 *   const [open, setOpen] = useState(false);
 *   <Button onClick={() => setOpen(true)}>Eliminar</Button>
 *   <ConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="¿Eliminar esta cotización?"
 *     description="No se puede deshacer."
 *     variant="destructive"
 *     loading={eliminar.isPending}
 *     onConfirm={handleEliminar}
 *   />
 */
'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
