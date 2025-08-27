import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, AlertTriangle, CheckCircle, Lightbulb, Upload, FileText, BarChart, DollarSign, Users, Briefcase, Building, Handshake, ShieldCheck, Clock, Zap } from 'lucide-react';
import Button from '../components/ui/Button';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
      {/* Hero Section */}
      <section
        className="relative bg-cover bg-center py-24 md:py-32 text-white"
        style={{ backgroundImage: 'url(https://images.pexels.com/photos/6238104/pexels-photo-6238104.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)' }}
      >
        <div className="absolute inset-0 bg-blue-900 opacity-80"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <Scale className="h-24 w-24 mx-auto mb-6 text-blue-200 drop-shadow-lg" />
          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6 drop-shadow-lg">
            Unlock Legal Clarity. Instantly.
          </h1>
          <p className="text-xl md:text-2xl mb-10 opacity-90 max-w-4xl mx-auto">
            Transform complex legal documents into actionable insights with AI. Identify risks, ensure compliance, and make informed decisions faster than ever before.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/signup">
              <Button variant="primary" size="lg" className="shadow-lg animate-pulse-slow">
                Start Your Instant Analysis Now!
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="secondary" size="lg" className="shadow-lg">
                Explore Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8">The Challenge: Manual Contract Review is Slow, Costly, and Risky</h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto mb-12">
            In today's fast-paced legal and business landscape, manually reviewing contracts is a bottleneck. It consumes valuable time, drains resources, and is prone to human error, leaving you exposed to hidden liabilities and compliance gaps.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md flex flex-col items-center">
              <Clock className="h-12 w-12 text-red-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Time-Consuming</h3>
              <p className="text-gray-600 dark:text-gray-400">Hours spent poring over dense legal text, delaying critical decisions and transactions.</p>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md flex flex-col items-center">
              <DollarSign className="h-12 w-12 text-red-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Expensive</h3>
              <p className="text-gray-600 dark:text-gray-400">High legal fees for review, or internal resources diverted from core business activities.</p>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md flex flex-col items-center">
              <AlertTriangle className="h-12 w-12 text-red-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">High Risk</h3>
              <p className="text-gray-600 dark:text-gray-400">Missed clauses, overlooked risks, and non-compliance can lead to costly disputes and penalties.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Introducing ContractAnalyser - Physical Product Description */}
      <section className="py-16 bg-blue-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url(https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)', backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Introducing ContractAnalyser: Your AI Legal Co-Pilot</h2>
            <p className="text-lg opacity-90 max-w-3xl mx-auto">
              Imagine a dedicated legal analyst, tirelessly working 24/7, meticulously reviewing every clause of your contracts. ContractAnalyser is that analyst, distilled into a powerful, intuitive digital platform.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <p className="text-lg leading-relaxed">
                It's not just a software; it's your AI-powered legal co-pilot, housed securely in the cloud, accessible from any device. Think of it as a high-precision scanner for legal risks, a smart compliance auditor, and a strategic advisor, all rolled into one seamless experience.
              </p>
              <ul className="list-disc list-inside space-y-3 text-lg">
                <li><CheckCircle className="inline-block h-5 w-5 mr-2 text-green-300" /> **Instant Deployment**: No complex installations. Access from your browser.</li>
                <li><CheckCircle className="inline-block h-5 w-5 mr-2 text-green-300" /> **Universal Compatibility**: Handles PDFs, DOCX, and DOC files with ease.</li>
                <li><CheckCircle className="inline-block h-5 w-5 mr-2 text-green-300" /> **Global Expertise**: Analyzes contracts across multiple jurisdictions (UK, EU, US, Canada, Australia, Ireland and Others).</li>
                <li><CheckCircle className="inline-block h-5 w-5 mr-2 text-green-300" /> **Actionable Output**: Delivers clear executive summaries, risk assessments, and practical recommendations.</li>
              </ul>
            </div>
            <div className="flex justify-center">
              <img src="https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" alt="ContractAnalyser in action" className="rounded-lg shadow-2xl max-w-full h-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-12">How ContractAnalyser Works: Simple Steps to Legal Clarity</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center text-center">
              <div className="bg-blue-100 dark:bg-blue-900 p-6 rounded-full mb-6 shadow-lg">
                <Upload className="h-16 w-16 text-blue-700 dark:text-blue-300" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">1. Upload Your Contract</h3>
              <p className="text-gray-600 dark:text-gray-400">Securely upload your PDF, DOCX, or DOC file. Select the relevant jurisdictions for analysis.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="bg-green-100 dark:bg-green-900 p-6 rounded-full mb-6 shadow-lg">
                <Zap className="h-16 w-16 text-green-700 dark:text-green-300" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">2. AI Analysis in Minutes</h3>
              <p className="text-gray-600 dark:text-gray-400">Our advanced AI meticulously scans every clause, identifying risks, compliance issues, and key terms.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="bg-purple-100 dark:bg-purple-900 p-6 rounded-full mb-6 shadow-lg">
                <BarChart className="h-16 w-16 text-purple-700 dark:text-purple-300" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">3. Get Actionable Reports</h3>
              <p className="text-gray-600 dark:text-gray-400">Receive a comprehensive report with an executive summary, compliance score, detailed findings, and practical recommendations.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits Section */}
      <section className="py-16 bg-gray-100 dark:bg-gray-700">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">Experience Unmatched Benefits</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
              <CheckCircle className="h-8 w-8 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Save Time & Resources</h3>
                <p className="text-gray-600 dark:text-gray-400">Automate tedious review tasks, freeing up your valuable time and reducing reliance on expensive external counsel.</p>
              </div>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
              <ShieldCheck className="h-8 w-8 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Mitigate Risks Effectively</h3>
                <p className="text-gray-600 dark:text-gray-400">Proactively identify and address potential liabilities, unfavorable clauses, and compliance gaps before they become problems.</p>
              </div>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
              <FileText className="h-8 w-8 text-purple-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Ensure Ironclad Compliance</h3>
                <p className="text-gray-600 dark:text-gray-400">Stay ahead of regulatory changes with AI-driven checks against relevant jurisdictional laws.</p>
              </div>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
              <Lightbulb className="h-8 w-8 text-yellow-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Gain Deeper Insights</h3>
                <p className="text-gray-600 dark:text-gray-400">Receive clear, concise executive summaries and actionable recommendations, transforming legal jargon into strategic intelligence.</p>
              </div>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
              <Handshake className="h-8 w-8 text-orange-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Accelerate Deal-Making</h3>
                <p className="text-gray-600 dark:text-gray-400">Speed up due diligence and contract negotiation cycles, enabling faster and more confident business decisions.</p>
              </div>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
              <Users className="h-8 w-8 text-teal-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Empower Your Team</h3>
                <p className="text-gray-600 dark:text-gray-400">Provide your legal and business teams with a powerful tool to enhance their efficiency and accuracy.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who Benefits Section */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-12">Who Benefits from ContractAnalyser?</h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto mb-12">
            ContractAnalyser is built for anyone who deals with legal documents and needs to understand them quickly and accurately.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md">
              <Briefcase className="h-10 w-10 text-blue-600 mb-4 mx-auto" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Legal Professionals</h3>
              <p className="text-gray-600 dark:text-gray-400">
                In-house counsel, private practice lawyers, paralegals, and legal tech specialists. Ideal for Mergers & Acquisitions, real estate, corporate law, and litigation support.
              </p>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md">
              <Building className="h-10 w-10 text-green-600 mb-4 mx-auto" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Businesses & Entrepreneurs</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Small, medium or large enterprises, startups, and business owners needing to quickly understand vendor agreements, partnership deeds, and client contracts.
              </p>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md">
              <Users className="h-10 w-10 text-purple-600 mb-4 mx-auto" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Compliance & HR Teams</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Compliance officers, HR managers, and risk analysts who need to ensure internal policies and employment contracts meet regulatory standards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent Pricing Section */}
      <section className="py-16 bg-gray-100 dark:bg-gray-700">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8">Flexible Pricing, No Commitments</h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto mb-12">
            We believe in transparency and flexibility. Our plans are designed to scale with your needs, whether you're a solo practitioner or a large enterprise.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col items-center">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">No Contract. No Obligation.</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                You're in control. Our service is month-to-month, with no hidden fees or long-term commitments.
              </p>
              <DollarSign className="h-16 w-16 text-blue-600 mb-6" />
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                Upgrade, downgrade, or cancel your subscription anytime, directly from your dashboard.
              </p>
              <Link to="/pricing">
                <Button variant="primary" size="lg">
                  View All Plans
                </Button>
              </Link>
            </div>
            <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col items-center">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Pay-As-You-Go Option</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Need a single analysis? Our one-time purchase option is perfect for occasional use.
              </p>
              <FileText className="h-16 w-16 text-green-600 mb-6" />
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                Get a full, detailed analysis report without a recurring subscription.
              </p>
              <Link to="/pricing">
                <Button variant="secondary" size="lg">
                  Get a Single Analysis
                </Button>
              </Link>
            </div>
            <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col items-center">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Scalable Subscriptions</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                For regular users, our Professional and Enterprise plans offer comprehensive features.
              </p>
              <Users className="h-16 w-16 text-purple-600 mb-6" />
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                Benefit from multi-user unlimited access, higher analysis limits, and priority support.
              </p>
              <Link to="/pricing">
                <Button variant="primary" size="lg">
                  Choose Your Plan
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action Section */}
      <section className="py-16 bg-blue-900 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight">
            Stop Drowning in Legal Jargon. Start Analyzing Smarter.
          </h2>
          <p className="text-xl md:text-2xl mb-10 opacity-90 max-w-3xl mx-auto">
            Join the growing number of professionals who are revolutionizing their contract review process.
            Sign up today and experience the power of AI-driven legal analysis.
          </p>
          <Link to="/signup">
            <Button variant="primary" size="lg" className="shadow-xl animate-bounce-slow">
              Sign Up Now & Get Instant Clarity!
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-800 text-white text-center text-sm">
        <div className="container mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} ContractAnalyser. All rights reserved.</p>
          <div className="mt-4 flex justify-center space-x-4">
            <Link to="/disclaimer" className="text-gray-300 hover:text-white transition-colors">Disclaimer</Link>
            <Link to="/terms" className="text-gray-300 hover:text-white transition-colors">Terms</Link>
            <Link to="/privacy-policy" className="text-gray-300 hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/help" className="text-gray-300 hover:text-white transition-colors">Help</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;