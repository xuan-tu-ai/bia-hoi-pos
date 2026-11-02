// FR-06, FR-08: thao tác hủy/giảm phải có PIN của Quản lý ca. Hộp thoại xin phiếu duyệt rồi trả về token.

import { useState } from 'react';
import { api, errorText } from '../lib/api';
import { Dialog, PinPad } from './ui';

export function ApprovalDialog({
  open,
  summary,
  onApproved,
  onClose,
}: {
  open: boolean;
  /** Mô tả việc cần duyệt, hiện cho quản lý đọc trước khi nhập PIN */
  summary: string;
  onApproved: (approvalToken: string, approverName: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(pin: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ approvalToken: string; approver: { name: string } }>('/auth/approve', { method: 'POST', body: { pin } });
      await onApproved(res.approvalToken, res.approver.name);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} title="Quản lý ca duyệt" onClose={onClose}>
      <p className="approval-summary">{summary}</p>
      {open && <PinPad label="PIN quản lý ca" onSubmit={submit} busy={busy} submitLabel="Duyệt" />}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
