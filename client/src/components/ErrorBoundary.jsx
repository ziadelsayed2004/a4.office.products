import { Component } from 'react';
import { Button } from '@mui/material';
import { ErrorOutlineRounded, RefreshRounded } from '@mui/icons-material';
import './ErrorBoundary.css';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('A4 frontend runtime error', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="fatal-error" dir="rtl" aria-labelledby="fatal-error-title">
        <div className="fatal-error__card">
          <div className="fatal-error__icon" aria-hidden="true">
            <ErrorOutlineRounded />
          </div>
          <h1 id="fatal-error-title">تعذر عرض الصفحة</h1>
          <p>
            حدث خطأ غير متوقع داخل الواجهة. أعد تحميل الصفحة، ولن تتأثر البيانات المسجلة في الخادم.
          </p>
          <Button
            variant="contained"
            startIcon={<RefreshRounded />}
            onClick={() => window.location.reload()}
          >
            إعادة تحميل المنصة
          </Button>
        </div>
      </main>
    );
  }
}

export default ErrorBoundary;
