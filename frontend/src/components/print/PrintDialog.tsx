import type { ReactNode } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PrintPortal, printNow } from './PrintPortal';

/** Xem trước bản in + nút In (gọi window.print(), chỉ in phần phiếu). */
export function PrintDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  extraActions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  extraActions?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto rounded-md bg-stone-100 p-4">{children}</div>
        <DialogFooter>
          {extraActions}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button onClick={printNow}>
            <Printer /> In
          </Button>
        </DialogFooter>
        {open && <PrintPortal>{children}</PrintPortal>}
      </DialogContent>
    </Dialog>
  );
}
