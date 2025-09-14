import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { LifeBuoy, BookOpen, Lightbulb, Bug, XCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import SupportTicketForm from '../forms/SupportTicketForm';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // ADDED

interface DashboardHelpModalProps {
  onReportIssue?: () => void;
}

const DashboardHelpModal: React.FC<DashboardHelpModalProps> = () => {
  const [isSupportTicketModalOpen, setIsSupportTicketModalOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation(); // ADDED

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
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('access_restricted_modal')}</h2> {/* MODIFIED */}
        <p className="text-gray-700 mb-4">
          {t('help_unavailable_during_reset_modal')} {/* MODIFIED */}
        </p>
        <Button 
          variant="primary" 
          onClick={() => {
            const currentHash = window.location.hash.includes('type=recovery') ? window.location.hash : '';
            navigate(`/reset-password${currentHash}`, { replace: true });
          }}
        >
          {t('continue_password_reset_modal')} {/* MODIFIED */}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <Button variant="primary" onClick={handleReportIssueClick} className="w-full">
          <Bug className="h-5 w-5 mr-2" /> {t('click_here_report_issue')} {/* MODIFIED */}
        </Button>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-3">
        <BookOpen className="h-5 w-5 mr-2 text-blue-600" /> {t('dashboard_overview_modal')} {/* MODIFIED */}
      </h3>
      <p className="text-gray-700 mb-4">
        {t('dashboard_overview_desc_modal')} {/* MODIFIED */}
      </p>
      <ul className="list-disc list-inside text-gray-700 space-y-2 mb-6">
        <li>
          **{t('contract_list_modal')}**: {t('contract_list_desc_modal')} {/* MODIFIED */}
        </li>
        <li>
          **{t('analysis_progress_modal')}**: {t('analysis_progress_desc_modal')} {/* MODIFIED */}
        </li>
        <li>
          **{t('selecting_contracts_modal')}**: {t('selecting_contracts_desc_modal')} {/* MODIFIED */}
        </li>
      </ul>

      <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-3">
        <Lightbulb className="h-5 w-5 mr-2 text-yellow-600" /> {t('understanding_analysis_results_modal')} {/* MODIFIED */}
      </h3>
      <p className="text-gray-700 mb-4">
        {t('analysis_results_desc_modal')} {/* MODIFIED */}
      </p>
      <ul className="list-disc list-inside text-gray-700 space-y-2 mb-6">
        <li>
          **{t('executive_summary_modal')}**: {t('executive_summary_desc_modal')} {/* MODIFIED */}
        </li>
        <li>
          **{t('compliance_score_modal')}**: {t('compliance_score_desc_modal')} {/* MODIFIED */}
        </li>
        <li>
          **{t('findings_modal')}**: {t('findings_desc_modal')} {/* MODIFIED */}
        </li>
        <li>
          **{t('jurisdiction_summaries_modal')}**: {t('jurisdiction_summaries_desc_modal')} {/* MODIFIED */}
        </li>
      </ul>

      <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-3">
        <LifeBuoy className="h-5 w-5 mr-2 text-green-600" /> {t('need_more_help_modal')} {/* MODIFIED */}
      </h3>
      <p className="text-gray-700">
        {t('further_questions_contact_support_modal', { helpCenterLink: <Link to="/help" className="text-blue-600 hover:underline">{t('help_center_modal')}</Link> })} {/* MODIFIED */}
      </p>

      <Modal
        isOpen={isSupportTicketModalOpen}
        onClose={() => setIsSupportTicketModalOpen(false)}
        title={t('report_an_issue_modal')} {/* MODIFIED */}
      >
        <SupportTicketForm />
      </Modal>
    </div>
  );
};

export default DashboardHelpModal;