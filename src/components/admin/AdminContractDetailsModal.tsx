import React, { useState, useEffect } from 'react';
import { AdminContract } from '../../services/adminService';
import AnalysisResults from '../analysis/AnalysisResults';
import JurisdictionSummary from '../analysis/JurisdictionSummary';
import Card, { CardBody } from '../ui/Card';
import { User, Mail, FileText, Calendar, Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../../hooks/useSubscription';
import { supabase } from '../../lib/supabase';
import { RedlinedClauseArtifact } from '../../types';

interface AdminContractDetailsModalProps {
  contract: AdminContract;
}

const AdminContractDetailsModal: React.FC<AdminContractDetailsModalProps> = ({ contract }) => {
  const { t } = useTranslation();
  const { subscription, loading: loadingSubscription } = useSubscription();

  // ADDED: Determine if user is on an advanced plan
  const isAdvancedPlan = subscription && (subscription.tier === 4 || subscription.tier === 5);

  // ADDED: State for redlined clause artifact content
  const [redlinedClauseContent, setRedlinedClauseContent] = useState<RedlinedClauseArtifact | null>(null);
  const [loadingRedlinedClause, setLoadingRedlinedClause] = useState(false);
  const [redlinedClauseError, setRedlinedClauseError] = useState<string | null>(null);

  // ADDED: Fetch redlined clause artifact if path exists and user is on advanced plan
  useEffect(() => {
    // MODIFIED: Condition changed to check contract.analysisResult?.performedAdvancedAnalysis
    if (!contract.analysisResult?.performedAdvancedAnalysis || !contract.analysisResult?.redlinedClauseArtifactPath) {
      setRedlinedClauseContent(null);
      return;
    }

    setLoadingRedlinedClause(true);
    setRedlinedClauseError(null);
    try {
      const fetchRedlinedClause = async () => {
        const { data, error } = await supabase.storage
          .from('contract_artifacts') // NEW STORAGE BUCKET
          .download(contract.analysisResult.redlinedClauseArtifactPath);

        if (error) throw error;

        const text = await data.text();
        setRedlinedClauseContent(JSON.parse(text));
      };
      fetchRedlinedClause();
    } catch (err: any) {
      console.error('Error fetching redlined clause artifact:', err);
      setRedlinedClauseError(t('failed_to_load_redlined_clause', { message: err.message }));
    } finally {
      setLoadingRedlinedClause(false);
    }
  }, [contract.analysisResult?.redlinedClauseArtifactPath, contract.analysisResult?.performedAdvancedAnalysis, t]); // MODIFIED: Dependency changed

  // ADDED: Handle download of redlined clause artifact
  const handleDownloadRedlinedClause = async () => {
    if (!contract.analysisResult?.redlinedClauseArtifactPath) return;

    try {
      const { data, error } = await supabase.storage
        .from('contract_artifacts')
        .createSignedUrl(contract.analysisResult.redlinedClauseArtifactPath, 60); // 60 seconds validity

      if (error) throw error;

      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = `redlined_clause_${contract.id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      alert(t('redlined_clause_download_started'));
    } catch (err: any) {
      console.error('Error downloading redlined clause artifact:', err);
      alert(t('failed_to_download_redlined_clause', { message: err.message }));
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'status_pending';
      case 'analyzing':
        return 'status_analyzing';
      case 'completed':
        return 'status_completed';
      case 'failed':
        return 'status_failed';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Contract and User Info */}
      <Card>
        <CardBody>
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('contract_information_modal')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div>
              <p><strong className="font-medium">{t('contract_name')}:</strong> {contract.translated_name || contract.name}</p>
              <p><strong className="font-medium">{t('status')}:</strong> {t(getStatusLabel(contract.status))}</p>
              <p><strong className="font-medium">{t('size')}:</strong> {contract.size}</p>
              <p><strong className="font-medium">{t('uploaded_on_modal')}:</strong> {new Date(contract.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="flex items-center"><User className="h-4 w-4 mr-2" /> <strong className="font-medium">{t('user')}:</strong> {contract.user_full_name}</p>
              <p className="flex items-center"><Mail className="h-4 w-4 mr-2" /> <strong className="font-medium">{t('email_address')}:</strong> {contract.user_email}</p>
              <p><strong className="font-medium">{t('marked_for_deletion_modal')}:</strong> {contract.marked_for_deletion_by_admin ? t('yes') : t('no')}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Analysis Results */}
      {contract.analysisResult ? (
        <>
          <AnalysisResults analysisResult={contract.analysisResult} isSample={false} contractName={contract.translated_name || contract.name} />

          {/* MODIFIED: Artifacts Section (Conditional for performedAdvancedAnalysis) */}
          {contract.analysisResult.performedAdvancedAnalysis && contract.analysisResult.redlinedClauseArtifactPath && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('artifacts_section_title')}</h2>
              {loadingRedlinedClause ? (
                <div className="text-center py-4">
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-500">{t('loading_artifact')}</p>
                </div>
              ) : redlinedClauseError ? (
                <div className="text-center py-4 text-red-600">
                  <p>{redlinedClauseError}</p>
                </div>
              ) : redlinedClauseContent ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-800">{t('redlined_clause_artifact')}</h3>
                  <p className="text-sm text-gray-600">
                    {t('redlined_clause_artifact_description', { findingId: redlinedClauseContent.findingId || t('not_specified') })}
                  </p>
                  <div className="bg-gray-100 p-4 rounded-md font-mono text-sm overflow-x-auto">
                    <p className="font-bold text-gray-700">{t('original_clause')}:</p>
                    <pre className="whitespace-pre-wrap text-gray-800">{redlinedClauseContent.originalClause}</pre>
                    <p className="font-bold text-gray-700 mt-4">{t('redlined_version')}:</p>
                    <pre className="whitespace-pre-wrap text-red-600">{redlinedClauseContent.redlinedVersion}</pre>
                    <p className="font-bold text-gray-700 mt-4">{t('suggested_revision')}:</p>
                    <pre className="whitespace-pre-wrap text-green-600">{redlinedClauseContent.suggestedRevision}</pre>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadRedlinedClause}
                    icon={<Download className="w-4 h-4" />}
                  >
                    {t('download_artifact')}
                  </Button>
                </div>
              ) : (
                <p className="text-gray-500">{t('no_artifacts_generated')}</p>
              )}
            </div>
          )}

          {/* Jurisdiction Summaries */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('jurisdiction_summaries_modal')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(contract.analysisResult.jurisdictionSummaries).map((summary) => (
                <JurisdictionSummary key={summary.jurisdiction} summary={summary} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <Card>
          <CardBody className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">{t('no_analysis_results_available_modal')}</p>
            {contract.status === 'analyzing' && (
              <p className="text-gray-500 mt-2">{t('analysis_in_progress_modal', { progress: contract.processing_progress || 0 })}</p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default AdminContractDetailsModal;