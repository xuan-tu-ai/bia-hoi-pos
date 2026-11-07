import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/** Một trang lỗi không làm sập cả ứng dụng; reset khi đổi trang (key = đường dẫn). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-lg font-bold">Trang này gặp lỗi</h1>
        <p className="max-w-md text-sm text-muted-foreground">{this.state.error.message}</p>
        <Button variant="outline" onClick={() => this.setState({ error: null })}>Thử lại</Button>
      </div>
    );
  }
}
