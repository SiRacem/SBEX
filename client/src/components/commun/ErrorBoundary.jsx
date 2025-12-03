import React from 'react';
import { Container, Button, Card } from 'react-bootstrap';
import { FaExclamationTriangle, FaRedo, FaHome } from 'react-icons/fa';
import { withTranslation } from 'react-i18next'; // [1] استيراد HOC للترجمة

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  }

  render() {
    const { t } = this.props; // [2] الوصول لدالة الترجمة من الـ props

    if (this.state.hasError) {
      return (
        <Container className="d-flex justify-content-center align-items-center vh-100" style={{ backgroundColor: '#f8f9fa' }}>
          <Card className="text-center p-5 shadow-lg border-0" style={{ maxWidth: '550px', borderRadius: '24px' }}>
            <div className="mb-4">
                <div className="mb-3 d-inline-flex align-items-center justify-content-center bg-warning bg-opacity-10 p-4 rounded-circle">
                    <FaExclamationTriangle size={50} className="text-warning" />
                </div>
                {/* [3] استخدام مفاتيح الترجمة */}
                <h2 className="fw-bold text-dark mb-3">{t('errorBoundary.title', 'Oops! Something went wrong')}</h2>
                <p className="text-muted mb-4" style={{ lineHeight: '1.6' }}>
                  {t('errorBoundary.message', 'We encountered an unexpected error. Don\'t worry, you can try refreshing the page.')}
                </p>
                
                {/* عرض الخطأ للمطورين فقط */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="alert alert-danger text-start small mt-3 overflow-auto" style={{maxHeight: '120px', direction: 'ltr'}}>
                        <code>{this.state.error?.toString()}</code>
                    </div>
                )}
            </div>
            
            <div className="d-flex flex-column gap-3">
                <Button 
                    variant="primary" 
                    size="lg" 
                    className="rounded-pill shadow-sm fw-bold"
                    onClick={this.handleReload}
                >
                    <FaRedo className="me-2" /> {t('errorBoundary.refreshBtn', 'Refresh Page')}
                </Button>
                
                <a href="/" className="btn btn-link text-decoration-none text-muted">
                    <FaHome className="me-1" /> {t('errorBoundary.homeBtn', 'Back to Home')}
                </a>
            </div>
          </Card>
        </Container>
      );
    }

    return this.props.children; 
  }
}

// [4] تصدير المكون مغلفاً بـ withTranslation
export default withTranslation()(ErrorBoundary);