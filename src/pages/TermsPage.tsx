import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import StructuredData from '../components/StructuredData'; // ADDED: Import StructuredData

const TermsPage: React.FC = () => {
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Terms of Service - ContractAnalyser",
    "url": "https://www.contractanalyser.com/terms",
    "description": "Terms of Service for ContractAnalyser website, outlining user agreements and data retention policy.",
    "publisher": {
      "@type": "Organization",
      "name": "ContractAnalyser",
      "url": "https://www.contractanalyser.com/"
    }
  };

  return (
    <>
      <StructuredData schema={webPageSchema} /> {/* ADDED: Structured Data */}
      <div className="container mx-auto px-4 py-6 mt-16">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Landing Page
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last Updated: August 12, 2025</p>

        <p className="text-gray-700 mb-4">
          Please read these Terms of Service ("Terms," "Terms of Service") carefully before using the contractanalyser.com website (the "Service") operated by ContractAnalyser ("us," "we," or "our").
        </p>
        <p className="text-gray-700 mb-4">
          Your access to and use of the Service is conditioned upon your acceptance of and compliance with these Terms. These Terms apply to all visitors, users, and others who wish to access or use the Service.
        </p>
        <p className="text-gray-700 mb-6">
          By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you do not have permission to access the Service.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Accounts</h2>
        <p className="text-gray-700 mb-4">
          When you create an account with us, you guarantee that you are above the age of 18, and that the information you provide us is accurate, complete, and current at all times. Inaccurate, incomplete, or obsolete information may result in the immediate termination of your account on the Service.
        </p>
        <p className="text-gray-700 mb-4">
          You are responsible for maintaining the confidentiality of your account and password, including but not limited to the restriction of access to your computer and/or account. You agree to accept responsibility for any and all activities or actions that occur under your account and/or password. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
        </p>
        <p className="text-gray-700 mb-6">
          You may not use as a username the name of another person or entity or that is not lawfully available for use, a name or trademark that is subject to any rights of another person or entity other than you without appropriate authorization, or a name that is otherwise offensive, vulgar or obscene.
        </p>

        {/* MODIFIED: Data Retention Policy Section */}
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Retention Policy</h2>
        <p className="text-gray-700 mb-4">
          ContractAnalyser implements a data retention policy for all uploaded files and their corresponding analysis results. By using our Service, you acknowledge and agree to the following terms regarding data retention:
        </p>
        <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
          <li>
            <strong>For Single-Use Purchases:</strong> Any contracts uploaded and analyzed under a single-use purchase plan will have their associated files and analysis results automatically deleted from our servers after 30 days from the date of upload. It is your responsibility to download and save any necessary reports or data before this period expires.
          </li>
          <li>
            <strong>For Active Subscription Plans:</strong> For users with an active subscription, your uploaded contracts and their analysis results will be retained for the entire duration of your active subscription.
            The maximum number of file uploads at any given time is 200 for 'Professional Use' and 1000 for 'Enterprise Use'.
            Should your subscription be canceled or expire, your data will be subject to deletion after a grace period, typically 30 days, unless otherwise specified in your subscription agreement.
            To add more files after reaching the limit, please delete old files.
          </li>
          <li>
            <strong>Purpose of Policy:</strong> This policy is in place to manage storage resources efficiently, comply with data privacy regulations, and ensure that we only retain data for as long as necessary for the provision of our services.
          </li>
        </ul>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Intellectual Property</h2>
        <p className="text-gray-700 mb-6">
          The Service and its original content (excluding Content provided by users), features, and functionality are and will remain the exclusive property of ContractAnalyser and its licensors. The Service is protected by copyright, trademark, and other laws of both the country and foreign countries. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of ContractAnalyser.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Links To Other Web Sites</h2>
        <p className="text-gray-700 mb-4">
          Our Service may contain links to third-party web sites or services that are not owned or controlled by ContractAnalyser.
        </p>
        <p className="text-gray-700 mb-4">
          ContractAnalyser has no control over, and assumes no responsibility for the content, privacy policies, or practices of any third-party web sites or services. We do not warrant the offerings of any of these entities/individuals or their websites.
        </p>
        <p className="text-gray-700 mb-6">
          You acknowledge and agree that ContractAnalyser shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with use of or reliance on any such content, goods or services available on or through any such third-party web sites or services.
        </p>
        <p className="text-gray-700 mb-6">
          We strongly advise you to read the terms and conditions and privacy policies of any third-party web sites or services that you visit.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Termination</h2>
        <p className="text-gray-700 mb-4">
          We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of the Terms.
        </p>
        <p className="text-gray-700 mb-4">
          If you wish to terminate your account, you may simply discontinue using the Service.
        </p>
        <p className="text-gray-700 mb-6">
          All provisions of the Terms which by their nature should survive termination shall survive termination, including, without limitation, ownership provisions, warranty disclaimers, indemnity and limitations of liability.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Indemnification</h2>
        <p className="text-gray-700 mb-6">
          You agree to defend, indemnify and hold harmless ContractAnalyser and its licensee and licensors, and their employees, contractors, agents, officers and directors, from and against any and all claims, damages, obligations, losses, liabilities, costs or debt, and expenses (including but not limited to attorney's fees), resulting from or arising out of a) your use and access of the Service, by you or any person using your account and password; b) a breach of these Terms, or c) Content posted on the Service.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Limitation Of Liability</h2>
        <p className="text-gray-700 mb-6">
          In no event shall ContractAnalyser, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage, and even if a remedy set forth herein is found to have failed of its essential purpose.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Disclaimer</h2>
        <p className="text-gray-700 mb-4">
          Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" basis. The Service is provided without warranties of any kind, whether express or implied, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose, non-infringement or course of performance.
        </p>
        <p className="text-gray-700 mb-6">
          ContractAnalyser its subsidiaries, affiliates, and its licensors do not warrant that a) the Service will function uninterrupted, secure or available at any particular time or location; b) any errors or defects will be corrected; c) the Service is free of viruses or other harmful components; or d) the results of using the Service will meet your requirements.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Governing Law</h2>
        <p className="text-gray-700 mb-4">
          These Terms shall be governed and construed in accordance with the laws of Ireland, without regard to its conflict of law provisions.
        </p>
        <p className="text-gray-700 mb-6">
          Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect. These Terms constitute the entire agreement between us regarding our Service, and supersede and replace any prior agreements we might have had between us regarding the Service.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes</h2>
        <p className="text-gray-700 mb-4">
          We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
        </p>
        <p className="text-gray-700 mb-4">
          By continuing to access or use our Service after any revisions become effective, you agree to be bound by the revised terms. If you do not agree to the new terms, you are no longer authorized to use the Service.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
        <p className="text-gray-700 mb-6">
          If you have any questions about these Terms, please contact us on the Help page.
        </p>
      </div>
    </>
  );
};

export default TermsPage;