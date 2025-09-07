import React from 'react';
import { AdminContract } from '../../services/adminService';
import AnalysisResults from '../analysis/AnalysisResults';
import JurisdictionSummary from '../analysis/JurisdictionSummary';
import Card, { CardBody } from '../ui/Card';
import { User, Mail, FileText, Calendar } from 'lucide-react';

interface AdminContractDetailsModalProps {
  contract: AdminContract;
}

const AdminContractDetailsModal: React.FC<AdminContractDetailsModalProps> = ({ contract }) => {
  return (
    <div className="space-y-6">
      {/* Contract and User Info */}
      <Card>
        <CardBody>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Contract Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div>
              <p><strong className="font-medium">Contract Name:</strong> {contract.name}</p>
              <p><strong className="font-medium">Status:</strong> {contract.status}</p>
              <p><strong className="font-medium">Size:</strong> {contract.size}</p>
              <p><strong className="font-medium">Uploaded On:</strong> {new Date(contract.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="flex items-center"><User className="h-4 w-4 mr-2" /> <strong className="font-medium">User:</strong> {contract.user_full_name}</p>
              <p className="flex items-center"><Mail className="h-4 w-4 mr-2" /> <strong className="font-medium">Email:</strong> {contract.user_email}</p>
              <p><strong className="font-medium">Marked for Deletion:</strong> {contract.marked_for_deletion_by_admin ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Analysis Results */}
      {contract.analysisResult ? (
        <>
          <AnalysisResults analysisResult={contract.analysisResult} isSample={false} />

          {/* Jurisdiction Summaries */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Jurisdiction Summaries</h2>
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
            <p className="text-gray-500">No analysis results available for this contract yet.</p>
            {contract.status === 'analyzing' && (
              <p className="text-gray-500 mt-2">Analysis is in progress ({contract.processing_progress || 0}% complete).</p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default AdminContractDetailsModal;