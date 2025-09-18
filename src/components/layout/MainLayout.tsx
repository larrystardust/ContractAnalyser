import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Modal from '../ui/Modal';
import DashboardHelpModal from '../dashboard/DashboardHelpModal';
import { useTranslation } from 'react-i18next'; // ADDED

interface MainLayoutProps {
  onOpenHelpModal: () => void;
  isDashboardHelpModalOpen: boolean;
  setIsDashboardHelpModal: (isOpen: boolean) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ onOpenHelpModal, isDashboardHelpModalOpen, setIsDashboardHelpModal }) => {
  const { t } = useTranslation(); // ADDED

  // This function is passed to DashboardHelpModal, which is part of this layout
  const handleReportIssue = () => {
    console.log('Report Issue button clicked!');
    alert('Redirecting to support ticket creation (not implemented yet).');
  };

  return (
    <>
      <Header onOpenHelpModal={onOpenHelpModal} />
      <main>
        <Outlet /> {/* This is where nested routes will render */}
      </main>
      {/* Dashboard Help Modal */}
      <Modal
        isOpen={isDashboardHelpModalOpen}
        onClose={() => setIsDashboardHelpModal(false)}
        title={t('dashboard_help_title')} // MODIFIED
      >
        <DashboardHelpModal onReportIssue={handleReportIssue} />
      </Modal>
    </>
  );
};

export default MainLayout;