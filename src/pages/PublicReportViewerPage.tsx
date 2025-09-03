import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card, { CardBody } from '../components/ui/Card';
import { Loader2, AlertCircle } from 'lucide-react';

const PublicReportViewerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const reportUrl = searchParams.get('url'); // Get the signed URL from query params

  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      if (!reportUrl) {
        setError('No report URL provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setReportHtml(null);

      try {
        const response = await fetch(reportUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch report content: ${response.status} ${response.statusText}`);
        }
        const htmlContent = await response.text();
        setReportHtml(htmlContent);

      } catch (err: any) {
        console.error('Error fetching report:', err);
        setError(err.message || 'Failed to load report. The link may have expired or is invalid.');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportUrl]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
        <p className="text-gray-500 mt-4">Loading report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50">
        <Card className="max-w-md w-full">
          <CardBody className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Report</h2>
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