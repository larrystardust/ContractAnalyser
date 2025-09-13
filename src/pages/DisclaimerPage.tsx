import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import StructuredData from '../components/StructuredData'; // ADDED: Import StructuredData

const DisclaimerPage: React.FC = () => {
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Disclaimer - ContractAnalyser",
    "url": "https://www.contractanalyser.com/disclaimer",
    "description": "Disclaimer for ContractAnalyser website regarding legal advice and external links.",
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

        <h1 className="text-3xl font-bold text-gray-900 mb-6">Disclaimer</h1>
        <p className="text-sm text-gray-500 mb-8">Last Updated: August 12, 2025</p>

        <p className="text-gray-700 mb-4">
          The information provided by ContractAnalyser ("we," "us," or "our") on contractanalyser.com (the "Site") is for general informational purposes only. All information on the Site is provided in good faith, however, we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the Site.
        </p>
        <p className="text-gray-700 mb-6">
          UNDER NO CIRCUMSTANCE SHALL WE HAVE ANY LIABILITY TO YOU FOR ANY LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF THE USE OF THE SITE OR RELIANCE ON ANY INFORMATION PROVIDED ON THE SITE. YOUR USE OF THE SITE AND YOUR RELIANCE ON ANY INFORMATION ON THE SITE IS SOLELY AT YOUR OWN RISK.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Professional Disclaimer</h2>
        <p className="text-gray-700 mb-4">
          The Site cannot and does not contain legal advice. The legal information is provided for general informational and educational purposes only and is not a substitute for professional legal advice. Accordingly, before taking any actions based upon such information, we encourage you to consult with the appropriate legal professionals. We do not provide any kind of legal advice.
        </p>
        <p className="text-gray-700 mb-6">
          THE USE OR RELIANCE OF ANY INFORMATION CONTAINED ON THIS SITE IS SOLELY AT YOUR OWN RISK.
        </p>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">External Links Disclaimer</h2>
        <p className="text-gray-700 mb-4">
          The Site may contain (or you may be sent through the Site) links to other websites or content belonging to or originating from third parties or links to websites and features in banners or other advertising. Such external links are not investigated, monitored, or checked for accuracy, adequacy, validity, reliability, or completeness by us.
        </p>
        <p className="text-gray-700 mb-6">
          WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR THE ACCURACY OR RELIABILITY OF ANY INFORMATION OFFERED BY THIRD-PARTY WEBSITES LINKED THROUGH THE SITE OR ANY WEBSITE OR FEATURE LINKED IN ANY BANNER OR OTHER ADVERTISING. WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY TRANSACTION BETWEEN YOU AND THIRD-PARTY PROVIDERS OF PRODUCTS OR SERVICES.
        </p>
      </div>
    </>
  );
};

export default DisclaimerPage;