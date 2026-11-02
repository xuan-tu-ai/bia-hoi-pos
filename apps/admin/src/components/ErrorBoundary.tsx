import { Component, type ReactNode } from 'react';

/** Một màn bị lỗi khi hiển thị thì chỉ màn đó báo lỗi, khung điều hướng vẫn dùng được. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="title-row">
        <div>
          <h1>Màn hình gặp lỗi</h1>
          <p className="sub">Đã có lỗi khi hiển thị trang này ({this.state.error.message}). Thử tải lại; nếu vẫn lỗi, báo cho nhóm phát triển.</p>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }
}
