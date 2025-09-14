import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card, { CardBody } from '../components/ui/Card';
import { Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ADDED

const PublicReportViewerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const reportUrl = searchParams.get('url');
  const { t } = useTranslation(); // ADDED

  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      if (!reportUrl) {
        setError(t('no_report_url_provided')); // MODIFIED
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setReportHtml(null);

      try {
        const response = await fetch(reportUrl);
        if (!response.ok) {
          throw new Error(t('failed_to_fetch_report', { status: response.status, statusText: response.statusText })); // MODIFIED
        }
        const htmlContent = await response.text();
        setReportHtml(htmlContent);

      } catch (err: any) {
        console.error('Error fetching report:', err);
        setError(err.message || t('link_expired_invalid')); // MODIFIED
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportUrl, t]); // MODIFIED: Added t to dependency array

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
        <p className="text-gray-500 mt-4">{t('loading_report')}</p> {/* MODIFIED */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50">
        <Card className="max-w-md w-full">
          <CardBody className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('error_loading_report')}</h2> {/* MODIFIED */}
            <p className="text-gray-600">{error}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Render the HTML content directly within a minimal container
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <Card>
          <CardBody>
            <div dangerouslySetInnerHTML={{ __html: reportHtml || '' }} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default PublicReportViewerPage;