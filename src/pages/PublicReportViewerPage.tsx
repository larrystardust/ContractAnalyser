import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card, { CardBody } from '../components/ui/Card';
import { Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ADDED

const PublicReportViewerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const reportUrl = searchParams.get('url'); // For main analysis reports
  const artifactPath = searchParams.get('artifactPath'); // For redlined artifacts
  const lang = searchParams.get('lang'); // For redlined artifacts, to pass to Edge Function
  const { t, i18n } = useTranslation(); // ADDED

  const [contentHtml, setContentHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      setError(null);
      setContentHtml(null);

      if (reportUrl) {
        // Scenario 1: Displaying a full analysis report (HTML content)
        try {
          const response = await fetch(reportUrl);
          if (!response.ok) {
            throw new Error(t('failed_to_fetch_report', { status: response.status, statusText: response.statusText }));
          }
          const htmlContent = await response.text();
          setContentHtml(htmlContent);
        } catch (err: any) {
          console.error('Error fetching report:', err);
          setError(err.message || t('link_expired_invalid'));
        } finally {
          setLoading(false);
        }
      } else if (artifactPath) { // MODIFIED: Check for artifactPath
        // Scenario 2: Displaying a redlined clause artifact (HTML content from Edge Function)
        try {
          // Construct the URL to the view-redlined-artifact Edge Function
          const artifactViewerUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/view-redlined-artifact?artifactPath=${encodeURIComponent(redlinedClauseArtifactPath)}&lang=${lang || i18n.language}`;
          
          const response = await fetch(artifactViewerUrl);

          if (!response.ok) {
            const errorData = await response.json(); // Assuming Edge Function returns JSON error
            throw new Error(errorData.error || t('failed_to_load_artifact'));
          }

          const htmlContent = await response.text(); // Expecting HTML content
          setContentHtml(htmlContent);

        } catch (err: any) {
          console.error('Error fetching redlined artifact:', err);
          setError(err.message || t('failed_to_load_artifact'));
        } finally {
          setLoading(false);
        }
      } else {
        setError(t('no_report_or_artifact_url_provided'));
        setLoading(false);
      }
    };

    fetchContent();
  }, [reportUrl, artifactPath, lang, t, i18n.language]); // MODIFIED: Added lang and i18n.language to dependencies

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900"></div>
        <p className="text-gray-500 mt-4">{t('loading_report')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50">
        <Card className="max-w-md w-full">
          <CardBody className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('error_loading_report')}</h2>
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
            <div dangerouslySetInnerHTML={{ __html: contentHtml || '' }} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default PublicReportViewerPage;