import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, AlertTriangle, CheckCircle, Lightbulb, Upload, FileText, BarChart, DollarSign, Users, Briefcase, Building, Handshake, ShieldCheck, Clock, Zap, Camera, CalendarDays, Search, Maximize } from 'lucide-react'; // MODIFIED: Added Maximize icon
import Button from '../components/ui/Button';
import StructuredData from '../components/StructuredData';
import { useTranslation } from 'react-i18next';
import TestimonialsSection from '../components/TestimonialsSection';
import { Helmet } from 'react-helmet-async';
import i18n from '../i18n'; // Import i18n instance directly to get supported languages
import DemoAnalysisSection from '../components/DemoAnalysisSection'; // ADDED: Import DemoAnalysisSection

const LandingPage: React.FC = () => {
  const { t } = useTranslation(); // MODIFIED: Removed i18n from destructuring as we import it directly

  // Static content for all languages that search engines need to see immediately
  const staticContent = {
    h1: {
      en: "ContractAnalyser - AI-Powered Legal Contract Analysis & Risk Assessment",
      fr: "ContractAnalyser - Analyse de Contrats Juridiques par IA et Évaluation des Risques",
      es: "ContractAnalyser - Análisis de Contratos Legales con IA y Evaluación de Riesgos",
      ar: "ContractAnalyser - تحليل العقود القانونية بالذكاء الاصطناعي وتقييم المخاطر"
    },
    metaDescription: {
      en: "ContractAnalyser uses advanced AI to instantly analyze legal contracts, identify risks, ensure compliance, and provide actionable insights. Save time and reduce legal costs.",
      fr: "ContractAnalyser utilise l'IA avancée pour analyser instantanément les contrats juridiques, identifier les risques et assurer la conformité. Économisez du temps et réduisez les coûts juridiques.",
      es: "ContractAnalyser utiliza IA avanzada para analizar instantáneamente contratos legales, identificar riesgos, garantizar el cumplimiento y proporcionar información práctica. Ahorre tiempo y reduzca costos legales",
      ar: "يستخدم ContractAnalyser الذكاء الاصطناعي المتقدم لتحليل العقود القانونية على الفور، وتحديد المخاطر، وضمان الامتثال، وتقديم رؤى قابلة للتنفيذ. وفر الوقت وقلل التكاليف القانونية."
    }
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://contractanalyser.com/#website",
        "url": "https://contractanalyser.com/",
        "name": "ContractAnalyser",
        "description": "AI-powered legal contract analysis platform for risk identification and compliance.",
        "publisher": {
          "@id": "https://contractanalyser.com/#organization"
        },
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": "https://contractanalyser.com/search?q={search_term_string}"
          },
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "Organization",
        "@id": "https://contractanalyser.com/#organization",
        "name": "ContractAnalyser",
        "url": "https://contractanalyser.com/",
        "logo": "https://contractanalyser.com/favicon.ico", // Assuming favicon is your logo
        "contactPoint": {
          "@type": "ContactPoint",
          "contactType": "customer service",
          // "email": "support@contractanalyser.com", // REMOVED: email property
        },
        "sameAs": [
          // "https://www.linkedin.com/company/contractanalyser", // REMOVED: social profiles
          // "https://twitter.com/contractanalyser" // REMOVED: social profies
        ]
      },
      // ADDED: Schema for the Blog Page
      {
        "@type": "WebPage",
        "@id": "https://contractanalyser.com/blog",
        "url": "https://contractanalyser.com/blog",
        "name": t('our_blog_title'),
        "description": t('our_blog_description'),
        "isPartOf": {
          "@id": "https://contractanalyser.com/#website"
        }
      }
    ]
  };

  // Get current language content
  const currentLang = i18n.language as keyof typeof staticContent.h1;
  const currentH1 = staticContent.h1[currentLang] || staticContent.h1.en;
  const currentMetaDescription = staticContent.metaDescription[currentLang] || staticContent.metaDescription.en;

  // Get all supported languages from i18n instance for hreflang tags
  const supportedLanguages = i18n.options.supportedLngs?.filter(lng => lng !== 'cimode' && lng !== 'dev') || [];

  return (
    <>
      <Helmet>
        <html lang={i18n.language} />
        <title>{t('landing_page_title') || "ContractAnalyser - AI Legal Contract Analysis"}</title>
        <meta
          name="description"
          content={t('landing_page_meta_description') || currentMetaDescription}
        />
        {/* Add hreflang tags for internationalization */}
        {supportedLanguages.map(lang => (
          <link
            key={lang}
            rel="alternate"
            hrefLang={lang}
            href={`https://contractanalyser.com/?lng=${lang}`}
          />
        ))}
        <link rel="alternate" hrefLang="x-default" href="https://contractanalyser.com/" />
      </Helmet>
      <StructuredData schema={websiteSchema} />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
        {/* Hero Section */}
        <section
          className="relative bg-cover bg-center py-24 md:py-32 text-white"
          style={{ backgroundImage: 'url(https://images.pexels.com/photos/6238104/pexels-photo-6238104.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)' }}
        >
          <div className="absolute inset-0 bg-blue-900 opacity-80"></div>
          <div className="container mx-auto px-4 text-center relative z-10">
            <Scale className="h-24 w-24 mx-auto mb-6 text-blue-200 drop-shadow-lg" />
            
            {/* Primary H1 - Always visible to search engines with proper language content */}
            <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6 drop-shadow-lg">
              {t('landing_hero_title') || currentH1} {/* MODIFIED */}
            </h1>
            
            {/* REMOVED: Redundant hidden H2 tags. Hreflang handles this better. */}
            
            <p className="text-xl md:text-2xl mb-10 opacity-90 max-w-4xl mx-auto">
              {t('landing_hero_description')} {/* MODIFIED */}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/signup">
                <Button variant="primary" size="lg" className="shadow-lg animate-pulse-slow">
                  {t('landing_hero_cta_start_analysis')} {/* MODIFIED */}
                </Button>
              </Link>
              {/* MODIFIED: Link to new landing-page-specific pricing page */}
              <Link to="/landing-pricing">
                <Button variant="secondary" size="lg" className="shadow-lg">
                  {t('landing_hero_cta_explore_pricing')} {/* MODIFIED */}
                </Button>
              </Link>
              {/* ADDED: Link to Sample Dashboard */}
              <Link to="/sample-dashboard">
                <Button variant="outline" size="lg" className="shadow-lg">
                  {t('landing_hero_cta_view_sample')} {/* MODIFIED */}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* The Problem Section */}
        <section className="py-16 bg-white dark:bg-gray-900">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8">{t('landing_problem_title')}</h2> {/* MODIFIED */}
            <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto mb-12">{t('landing_problem_description')}</p> {/* MODIFIED */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md flex flex-col items-center">
                <Clock className="h-12 w-12 text-red-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('landing_problem_time_consuming_title')}</h3> {/* MODIFIED */}
                <p className="text-gray-600 dark:text-gray-400">{t('landing_problem_time_consuming_description')}</p> {/* MODIFIED */}
              </div>
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md flex flex-col items-center">
                <DollarSign className="h-12 w-12 text-red-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('landing_problem_expensive_title')}</h3> {/* MODIFIED */}
                <p className="text-gray-600 dark:text-gray-400">{t('landing_problem_expensive_description')}</p> {/* MODIFIED */}
              </div>
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md flex flex-col items-center">
                <AlertTriangle className="h-12 w-12 text-red-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('landing_problem_high_risk_title')}</h3> {/* MODIFIED */}
                <p className="text-gray-600 dark:text-gray-400">{t('landing_problem_high_risk_description')}</p> {/* MODIFIED */}
              </div>
            </div>
          </div>
        </section>

        {/* Introducing ContractAnalyser - Physical Product Description */}
        <section className="py-16 bg-blue-800 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url(https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)', backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('landing_intro_title')}</h2> {/* MODIFIED */}
              <p className="text-lg opacity-90 max-w-3xl mx-auto">
                {t('landing_intro_description')} {/* MODIFIED */}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <p className="text-lg leading-relaxed">
                  {t('landing_intro_co_pilot_description')} {/* MODIFIED */}
                </p>
                <ul className="list-disc list-inside space-y-3 text-lg">
                  <li><CheckCircle className="inline-block h-5 w-5 mr-2 text-green-300" /> **{t('landing_intro_instant_deployment_title')}**: {t('landing_intro_instant_deployment_description')}</li> {/* MODIFIED */}
                  <li><CheckCircle className="inline-block h-5 w-5 mr-2 text-green-300" /> **{t('landing_intro_universal_compatibility_title')}**: {t('landing_intro_universal_compatibility_description_ocr')}</li> {/* MODIFIED: Updated description */}
                  <li><CheckCircle className="inline-block h-5 w-5 mr-2 text-green-300" /> **{t('landing_intro_global_expertise_title')}**: {t('landing_intro_global_expertise_description')}</li> {/* MODIFIED */}
                  <li><CheckCircle className="inline-block h-5 w-5 mr-2 text-green-300" /> **{t('landing_benefits_large_document_analysis_title')}**: {t('landing_benefits_large_document_analysis_description')}</li> {/* ADDITION: Large Document Analysis in Introduction */}
                  <li><CheckCircle className="inline-block h-5 w-5 mr-2 text-green-300" /> **{t('landing_intro_actionable_output_title')}**: {t('landing_intro_actionable_output_description')}</li> {/* MODIFIED */}
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
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-12">{t('landing_how_it_works_title')}</h2> {/* MODIFIED */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="flex flex-col items-center text-center">
                <div className="bg-blue-100 dark:bg-blue-900 p-6 rounded-full mb-6 shadow-lg">
                  <Upload className="h-16 w-16 text-blue-700 dark:text-blue-300" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">{t('landing_how_it_works_upload_title')}</h3> {/* MODIFIED */}
                <p className="text-gray-600 dark:text-gray-400">{t('landing_how_it_works_upload_description')}</p> {/* MODIFIED */}
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="bg-green-100 dark:bg-green-900 p-6 rounded-full mb-6 shadow-lg">
                  <Zap className="h-16 w-16 text-green-700 dark:text-green-300" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">{t('landing_how_it_works_ai_analysis_title')}</h3> {/* MODIFIED */}
                <p className="text-gray-600 dark:text-gray-400">{t('landing_how_it_works_ai_analysis_description')}</p> {/* MODIFIED */}
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="bg-purple-100 dark:bg-purple-900 p-6 rounded-full mb-6 shadow-lg">
                  <BarChart className="h-16 w-16 text-purple-700 dark:text-purple-300" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">{t('landing_how_it_works_actionable_reports_title')}</h3> {/* MODIFIED */}
                <p className="text-gray-600 dark:text-gray-400">{t('landing_how_it_works_actionable_reports_description')}</p> {/* MODIFIED */}
              </div>
            </div>
          </div>
        </section>

        {/* ADDED: Demo Analysis Section */}
        <DemoAnalysisSection />

        {/* ADDED: Advanced Features Section */}
        <section className="py-16 bg-gray-100 dark:bg-gray-700">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">{t('landing_advanced_features_title')}</h2>
            <p className="text-lg text-center text-gray-700 dark:text-gray-300 max-w-3xl mx-auto mb-12">
              {t('landing_advanced_features_description')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
                <CalendarDays className="h-8 w-8 text-indigo-600 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('landing_advanced_feature_key_dates_title')}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{t('landing_advanced_feature_key_dates_description')}</p>
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
                <Users className="h-8 w-8 text-pink-600 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('landing_advanced_feature_parties_title')}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{t('landing_advanced_feature_parties_description')}</p>
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
                <FileText className="h-8 w-8 text-teal-600 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('landing_advanced_feature_contract_type_value_title')}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{t('landing_advanced_feature_contract_type_value_description')}</p>
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
                <ShieldCheck className="h-8 w-8 text-orange-600 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('landing_advanced_feature_liability_indemnification_title')}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{t('landing_advanced_feature_liability_indemnification_description')}</p>
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
                <Search className="h-8 w-8 text-yellow-600 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('landing_advanced_feature_advanced_search_title')}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{t('landing_advanced_feature_advanced_search_description')}</p>
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
                <BarChart className="h-8 w-8 text-red-600 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('landing_advanced_feature_reports_analytics_title')}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{t('landing_advanced_feature_reports_analytics_description')}</p>
                </div>
              </div>
            </div>
            <div className="mt-12 text-center">
              <Link to="/landing-pricing">
                <Button variant="primary" size="lg" className="shadow-lg">
                  {t('landing_advanced_features_cta')}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Key Benefits Section */}
        <section className="py-16 bg-gray-100 dark:bg-gray-700">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">{t('landing_benefits_title')}</h2> {/* MODIFIED */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
                <CheckCircle className="h-8 w-8 text-blue-600 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('landing_benefits_save_time_title')}</h3> {/* MODIFIED */}
                  <p className="text-gray-600 dark:text-gray-400">{t('landing_benefits_save_time_description')}</p> {/* MODIFIED */}
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
                <ShieldCheck className="h-8 w-8 text-green-600 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('landing_benefits_mitigate_risks_title')}</h3> {/* MODIFIED */}
                  <p className="text-gray-600 dark:text-gray-400">{t('landing_benefits_mitigate_risks_description')}</p> {/* MODIFIED */}
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
                <FileText className="h-8 w-8 text-purple-600 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('landing_benefits_ensure_compliance_title')}</h3> {/* MODIFIED */}
                  <p className="text-gray-600 dark:text-gray-400">{t('landing_benefits_ensure_compliance_description')}</p> {/* MODIFIED */}
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
                <Lightbulb className="h-8 w-8 text-yellow-600 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('landing_benefits_gain_insights_title')}</h3> {/* MODIFIED */}
                  <p className="text-gray-600 dark:text-gray-400">{t('landing_benefits_gain_insights_description')}</p> {/* MODIFIED */}
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
                <Handshake className="h-8 w-8 text-orange-600 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('landing_benefits_accelerate_deals_title')}</h3> {/* MODIFIED */}
                  <p className="text-gray-600 dark:text-gray-400">{t('landing_benefits_accelerate_deals_description')}</p> {/* MODIFIED */}
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-start space-x-4">
                <Camera className="h-8 w-8 text-teal-600 flex-shrink-0" /> {/* MODIFIED: Changed icon to Camera */}
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('landing_benefits_ocr_title')}</h3> {/* MODIFIED: New OCR title */}
                  <p className="text-gray-600 dark:text-gray-400">{t('landing_benefits_ocr_description')}</p> {/* MODIFIED: New OCR description */}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Who Benefits Section */}
        <section className="py-16 bg-white dark:bg-gray-900">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-12">{t('landing_who_benefits_title')}</h2> {/* MODIFIED */}
            <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto mb-12">
              {t('landing_who_benefits_description')} {/* MODIFIED */}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md">
                <Briefcase className="h-10 w-10 text-blue-600 mb-4 mx-auto" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('landing_who_benefits_legal_professionals_title')}</h3> {/* MODIFIED */}
                <p className="text-gray-600 dark:text-gray-400">
                  {t('landing_who_benefits_legal_professionals_description')} {/* MODIFIED */}
                </p>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md">
                <Building className="h-10 w-10 text-green-600 mb-4 mx-auto" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('landing_who_benefits_businesses_title')}</h3> {/* MODIFIED */}
                <p className="text-gray-600 dark:text-gray-400">
                  {t('landing_who_benefits_businesses_description')} {/* MODIFIED */}
                </p>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md">
                <Users className="h-10 w-10 text-purple-600 mb-4 mx-auto" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('landing_who_benefits_compliance_hr_title')}</h3> {/* MODIFIED */}
                <p className="text-gray-600 dark:text-gray-400">
                  {t('landing_who_benefits_compliance_hr_description')} {/* MODIFIED */}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ADDED: Testimonials Section */}
        <TestimonialsSection />

        {/* Transparent Pricing Section */}
        <section className="py-16 bg-gray-100 dark:bg-gray-700">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8">{t('landing_pricing_title')}</h2> {/* MODIFIED */}
            <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto mb-12">
              {t('landing_pricing_description')} {/* MODIFIED */}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col items-center">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('landing_pricing_no_contract_title')}</h3> {/* MODIFIED */}
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {t('landing_pricing_no_contract_description')} {/* MODIFIED */}
                </p>
                <DollarSign className="h-16 w-16 text-blue-600 mb-6" />
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                  {t('landing_pricing_no_contract_cta_description')} {/* MODIFIED */}
                </p>
                {/* MODIFIED: Link to new landing-page-specific pricing page */}
                <Link to="/landing-pricing">
                  <Button variant="primary" size="lg">
                    {t('landing_pricing_no_contract_cta_button')} {/* MODIFIED */}
                  </Button>
                </Link>
              </div>
              <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col items-center">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('landing_pricing_pay_as_you_go_title')}</h3> {/* MODIFIED */}
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {t('landing_pricing_pay_as_you_go_description')} {/* MODIFIED */}
                </p>
                <FileText className="h-16 w-16 text-green-600 mb-6" />
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                  {t('landing_pricing_pay_as_you_go_cta_description')} {/* MODIFIED */}
                </p>
                {/* MODIFIED: Link to new landing-page-specific pricing page */}
                <Link to="/landing-pricing">
                  <Button variant="secondary" size="lg">
                    {t('landing_pricing_pay_as_you_go_cta_button')} {/* MODIFIED */}
                  </Button>
                </Link>
              </div>
              <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col items-center">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('landing_pricing_scalable_subscriptions_title')}</h3> {/* MODIFIED */}
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {t('landing_pricing_scalable_subscriptions_description')} {/* MODIFIED */}
                </p>
                <Users className="h-16 w-16 text-purple-600 mb-6" />
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                  {t('landing_pricing_scalable_subscriptions_cta_description')} {/* MODIFIED */}
                </p>
                {/* MODIFIED: Link to new landing-page-specific pricing page */}
                <Link to="/landing-pricing">
                  <Button variant="primary" size="lg">
                    {t('landing_pricing_scalable_subscriptions_cta_button')} {/* MODIFIED */}
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
              {t('landing_cta_title')} {/* MODIFIED */}
            </h2>
            <p className="text-xl md:text-2xl mb-10 opacity-90 max-w-3xl mx-auto">
              {t('landing_cta_description')} {/* MODIFIED */}
            </p>
            <Link to="/signup">
              <Button variant="primary" size="lg" className="shadow-xl animate-bounce-slow">
                {t('landing_cta_button')} {/* MODIFIED */}
              </Button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 bg-gray-800 text-white text-sm text-center">
          <div className="container mx-auto px-4">
            <p>{t('footer_copyright', { year: new Date().getFullYear() })}</p> {/* MODIFIED */}
            <div className="mt-4 flex justify-center space-x-4">
              <Link to="/disclaimer" className="text-gray-300 hover:text-white transition-colors">{t('disclaimer')}</Link> {/* MODIFIED */}
              <Link to="/terms" className="text-gray-300 hover:text-white transition-colors">{t('terms')}</Link> {/* MODIFIED */}
              <Link to="/privacy-policy" className="text-gray-300 hover:text-white transition-colors">{t('privacy_policy')}</Link> {/* MODIFIED */}
              <Link to="/help" className="text-gray-300 hover:text-white transition-colors">{t('help_page')}</Link> {/* MODIFIED */}
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;