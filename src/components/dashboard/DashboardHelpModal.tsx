import React, { useState } from 'react'; // ADDED: useState
import Button from '../ui/Button';
import { LifeBuoy, BookOpen, Lightbulb, Bug } from 'lucide-react';
import Modal from '../ui/Modal'; // ADDED: Import Modal
import SupportTicketForm from '../forms/SupportTicketForm'; // ADDED: Import SupportTicketForm
import { Link } from 'react-router-dom'; // ADDED: Import Link for Help Center

interface DashboardHelpModalProps {
  onReportIssue: () => void; // This prop is now optional or can be removed if we handle modal internally
}

const DashboardHelpModal: React.FC<DashboardHelpModalProps> = () => { // MODIFIED: Removed onReportIssue from props
  const [isSupportTicketModalOpen, setIsSupportTicketModalOpen] = useState(false); // ADDED: State for support ticket modal

  const handleReportIssueClick = () => { // ADDED: New handler
    setIsSupportTicketModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <Button variant="primary" onClick={handleReportIssueClick} className="w-full"> {/* MODIFIED: Use new handler */}
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

      {/* ADDED: Support Ticket Modal */}
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