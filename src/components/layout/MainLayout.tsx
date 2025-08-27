import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Modal from '../ui/Modal';
import DashboardHelpModal from '../dashboard/DashboardHelpModal';

interface MainLayoutProps {
  onOpenHelpModal: () => void;
  isDashboardHelpModalOpen: boolean;
  setIsDashboardHelpModal: (isOpen: boolean) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ onOpenHelpModal, isDashboardHelpModalOpen, setIsDashboardHelpModal }) => {
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
        title="Dashboard Help"
      >
        <DashboardHelpModal onReportIssue={handleReportIssue} />
      </Modal>
    </>
  );
};

export default MainLayout;