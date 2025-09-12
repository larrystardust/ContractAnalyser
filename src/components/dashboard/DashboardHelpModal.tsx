import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { LifeBuoy, BookOpen, Lightbulb, Bug, XCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import SupportTicketForm from '../forms/SupportTicketForm';
import { Link, useNavigate } from 'react-router-dom';

interface DashboardHelpModalProps {
  onReportIssue?: () => void;
}

const DashboardHelpModal: React.FC<DashboardHelpModalProps> = () => {
  const [isSupportTicketModalOpen, setIsSupportTicketModalOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const navigate = useNavigate();

  // Check if password reset flow is active and block the modal
  useEffect(() => {
    const checkPasswordResetFlow = () => {
      const resetFlowActive = localStorage.getItem('passwordResetFlowActive');
      const blockModals = localStorage.getItem('blockModalsDuringReset');
      
      if (resetFlowActive === 'true' || blockModals === 'true') {
        setIsBlocked(true);
        // Close any open modals immediately
        setIsSupportTicketModalOpen(false);
        
        // Redirect to reset-password page if not already there
        if (window.location.pathname !== '/reset-password') {
          const currentHash = window.location.hash.includes('type=recovery') ? window.location.hash : '';
          navigate(`/reset-password${currentHash}`, { replace: true });
        }
      } else {
        setIsBlocked(false);
      }
    };

    // Check immediately on mount
    checkPasswordResetFlow();

    // Listen for storage changes (from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'passwordResetFlowActive' || e.key === 'blockModalsDuringReset') {
        checkPasswordResetFlow();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Check periodically in case changes happen in the same tab
    const interval = setInterval(checkPasswordResetFlow, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [navigate]);

  const handleReportIssueClick = () => {
    // Check again before opening modal
    const resetFlowActive = localStorage.getItem('passwordResetFlowActive');
    const blockModals = localStorage.getItem('blockModalsDuringReset');
    
    if (resetFlowActive === 'true' || blockModals === 'true') {
      setIsBlocked(true);
      const currentHash = window.location.hash.includes('type=recovery') ? window.location.hash : '';
      navigate(`/reset-password${currentHash}`, { replace: true });
      return;
    }
    
    setIsSupportTicketModalOpen(true);
  };

  // If blocked during password reset, show blocked message instead of help content
  if (isBlocked) {
    return (
      <div className="space-y-6 text-center py-8">
        <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-700 mb-4">
          Help features are temporarily unavailable during password reset process.
          Please complete your password reset first.
        </p>
        <Button 
          variant="primary" 
          onClick={() => {
            const currentHash = window.location.hash.includes('type=recovery') ? window.location.hash : '';
            navigate(`/reset-password${currentHash}`, { replace: true });
          }}
        >
          Continue Password Reset
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <Button variant="primary" onClick={handleReportIssueClick} className="w-full">
          <Bug className="h-5 w-5 mr-2" /> Click Here To Report An Issue
        </Button>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-3">
        <BookOpen className="h-5 w-5 mr-2 text-blue-600" /> Dashboard Overview
      </h3>
      <p className="text-gray-700 mb-4">
        The Dashboard provides a quick overview of your contracts and analysis results.
        On the left, you'll find a list of all your uploaded contracts. You can click on any completed contract to view its detailed analysis.
      </p>
      <ul className="list-disc list-inside text-gray-700 space-y-2 mb-6">
        <li>
          **Contract List**: Displays all your contracts with their current status (Pending, Analyzing, Completed, Failed).
        </li>
        <li>
          **Analysis Progress**: For contracts that are still analyzing, a progress bar indicates the current stage of processing.
        </li>
        <li>
          **Selecting Contracts**: Click on a contract in the list to load its analysis results in the main content area.
        </li>
      </ul>

      <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-3">
        <Lightbulb className="h-5 w-5 mr-2 text-yellow-600" /> Understanding Analysis Results
      </h3>
      <p className="text-gray-700 mb-4">
        Once a contract analysis is complete, the main section of the dashboard will display:
      </p>
      <ul className="list-disc list-inside text-gray-700 space-y-2 mb-6">
        <li>
          **Executive Summary**: A high-level overview of the contract's key findings and compliance score.
        </li>
        <li>
          **Compliance Score**: An overall rating (0-100%) of the contract's adherence to legal standards.
        </li>
        <li>
          **Findings**: Detailed breakdown of identified risks, compliance issues, data protection impacts, and enforceability concerns. Each finding includes a risk level, jurisdiction, category, and recommendations.
        </li>
        <li>
          **Jurisdiction Summaries**: Specific insights and applicable laws relevant to each jurisdiction mentioned in the contract.
        </li>
      </ul>

      <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-3">
        <LifeBuoy className="h-5 w-5 mr-2 text-green-600" /> Need More Help?
      </h3>
      <p className="text-gray-700">
        If you have further questions or encounter any issues, please use the "Report an Issue" button above to create a support ticket, or visit our full <Link to="/help" className="text-blue-600 hover:underline">Help Center</Link> for more detailed guides and FAQs.
      </p>

      <Modal
        isOpen={isSupportTicketModalOpen}
        onClose={() => setIsSupportTicketModalOpen(false)}
        title="Report an Issue"
      >
        <SupportTicketForm />
      </Modal>
    </div>
  );
};

export default DashboardHelpModal;