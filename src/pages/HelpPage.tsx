import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal'; // Import the new Modal component
import ContactForm from '../components/forms/ContactForm'; // Import the new ContactForm component
import { ArrowLeft } from 'lucide-react'; // Import ArrowLeft icon

const HelpPage: React.FC = () => {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Landing Page
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">Help Center</h1>
      <p className="text-sm text-gray-500 mb-8">Last Updated: August 12, 2025</p>

      <p className="text-gray-700 mb-6">
        Welcome to the ContractAnalyser Help Center! Here you'll find answers to common questions and resources to help you get the most out of our service.
      </p>

      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Getting Started</h2>
      <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
        <li>
          <strong>What is ContractAnalyser?</strong>
          <p className="ml-4">ContractAnalyser is an AI-powered platform designed to help legal professionals, business owners, compliance officers, HR managers quickly analyze legal contracts/agreements for risks, compliance issues, and key insights.</p>
        </li>
        <li>
          <strong>How do I sign up?</strong>
          <p className="ml-4">You can sign up for a free account by clicking the "Sign Up" button on our homepage and following the registration steps.</p>
        </li>
        <li>
          <strong>What file types do you support?</strong>
          <p className="ml-4">We currently support PDF, DOCX, and DOC file formats for contract uploads. We **do not support OCR** for scanned documents or images. Please ensure your uploaded files contain **selectable (clear) text**. If your document is a scan or an image, you must perform OCR on it manually before uploading.</p>
        </li>
      </ul>

      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Uploading Contracts</h2>
      <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
        <li>
          <strong>How do I upload a contract?</strong>
          <p className="ml-4">After logging in, navigate to the "Upload" section. You can drag and drop your contract file or click "Browse Files" to select it from your computer.</p>
        </li>
        <li>
          <strong>What jurisdictions do you cover?</strong>
          <p className="ml-4">Our AI is trained to analyze contracts across various jurisdictions, including UK, EU, Ireland, US, Canada, Australia and Others. You can select the relevant jurisdictions during the upload process.</p>
        </li>
        <li>
          <strong>How long does analysis take?</strong>
          <p className="ml-4">Analysis time varies depending on the length and complexity of the contract. You can monitor the processing progress on your Dashboard.</p>
        </li>
      </ul>

      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Understanding Analysis Results</h2>
      <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
        <li>
          <strong>What is an Executive Summary?</strong>
          <p className="ml-4">The Executive Summary provides a high-level overview of the contract's key aspects, risks, and compliance status.</p>
        </li>
        <li>
          <strong>What are Findings?</strong>
          <p className="ml-4">Findings are specific issues or points of interest identified by our AI within the contract. Each finding includes a title, description, risk level, relevant jurisdiction, category, and recommendations.</p>
        </li>
        <li>
          <strong>What do the Risk Levels mean?</strong>
          <p className="ml-4">Risk levels (High, Medium, Low, None) indicate the severity of a finding.</p>
          <ul className="list-circle list-inside text-gray-700 ml-8 mt-1">
            <li><strong>High Risk:</strong> Significant legal or financial implications.</li>
            <li><strong>Medium Risk:</strong> Potential issues that require attention.</li>
            <li><strong>Low Risk:</strong> Minor issues or areas for improvement.</li>
            <li><strong>No Risk:</strong> No identified issues.</li>
          </ul>
        </li>
        <li>
          <strong>What is the Compliance Score?</strong>
          <p className="ml-4">The Compliance Score (0-100) is an overall assessment of how well the contract adheres to relevant legal and regulatory standards. A higher score indicates better compliance.</p>
        </li>
        <li>
          <strong>What is Data Protection Impact?</strong>
          <p className="ml-4">This section highlights any clauses or aspects of the contract that relate to data processing and privacy, assessing their impact on data protection compliance.</p>
        </li>
      </ul>

      {/* MODIFIED: Data Retention Policy Section */}
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Retention Policy</h2>
      <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
        <li>
          <strong>How long are my uploaded files and analysis results retained?</strong>
          <p className="ml-4">
            The retention period for your uploaded contracts and their analysis results depends on your plan:
          </p>
          <ul className="list-circle list-inside text-gray-700 ml-8 mt-1">
            <li>
              <strong>Single-Use Purchases:</strong> Files and their analysis results are automatically deleted after 30 days from the upload date.
            </li>
            <li>
              <strong>Active Subscription Plans:</strong> Your files and analysis results will be retained for the entire duration of your active subscription.
              The maximum number of files you can store at any given time is 200 for 'Professional Use' and 1000 for 'Enterprise Use'.
              If your subscription ends or is canceled, your data will be subject to deletion after a grace period of 30 days.
              To add more files after reaching your limit, please delete old files from your Contracts page.
            </li>
          </ul>
        </li>
        <li>
          <strong>Why is there a data retention policy?</strong>
          <p className="ml-4">
            This policy helps us manage storage resources efficiently and ensures that we only retain data for as long as necessary, aligning with best practices for data privacy and security.
          </p>
        </li>
      </ul>

      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Account & Billing</h2>
      <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
        <li>
          <strong>How do I update my profile information?</strong>
          <p className="ml-4">Go to "Settings" and then "Profile" to update your personal and company details.</p>
        </li>
        <li>
          <strong>How do I change my password?</strong>
          <p className="ml-4">In "Settings," navigate to "Security" to change your password and manage other security settings.</p>
        </li>
        <li>
          <strong>How do I manage my subscription?</strong>
          <p className="ml-4">Under "Settings," select "Billing" to view your current plan, manage your subscription, and access invoices.</p>
        </li>
        <li>
          <strong>What payment methods do you accept?</strong>
          <p className="ml-4">We accept major credit cards through our secure payment gateway (Stripe).</p>
        </li>
      </ul>

      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Troubleshooting</h2>
      <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
        <li>
          <strong>My upload failed. What should I do?</strong>
          <p className="ml-4">Ensure your file is in a supported format (PDF, DOCX, DOC) and try again. If the issue persists, please contact support with details of the error.</p>
        </li>
        <li>
          <strong>My contract is stuck in "Analyzing" status.</strong>
          <p className="ml-4">Analysis can take some time. If it remains stuck for an unusually long period (e.g., over an hour for a standard contract), please contact our support team.</p>
        </li>
        <li>
          <strong>Analysis failed or incomplete.</strong>
          <p className="ml-4">Scanned documents and images with text cannot be properly analyzed. If your document is a scan or an image, you must perform OCR on it manually before uploading.</p>
        </li>
        <li>
          <strong>I forgot my password.</strong>
          <p className="ml-4">On the login page, click "Forgot password?" and follow the instructions to reset it.</p>
        </li>
      </ul>

      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Support</h2>
      <p className="text-gray-700 mb-4">
        If you can't find the answer to your question here, please don't hesitate to contact our support team:
      </p>
      <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
        <li><strong>Click:</strong> Contact Us below</li>        
      </ul>
      <p className="text-gray-700 mb-6">
        Our support team is available Monday - Friday, 9 AM - 5 PM GMT.
      </p>

      <div className="mt-8 text-center">
        <Button variant="primary" onClick={() => setIsContactModalOpen(true)}>
          Contact Us
        </Button>
      </div>

      <Modal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        title="Contact Us"
      >
        <ContactForm />
      </Modal>
    </div>
  );
};

export default HelpPage;