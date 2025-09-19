import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart, Users, FileText, MessageSquare, LifeBuoy, DollarSign, Loader2, ListChecks } from 'lucide-react';
import Card, { CardBody } from '../components/ui/Card';
import adminService, { SystemReports, AuditLog } from '../services/adminService';
import { useTranslation } from 'react-i18next'; // ADDED

const AdminReportsPage: React.FC = () => {
  const [reports, setReports] = useState<SystemReports | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorAuditLogs, setErrorAuditLogs] = useState<string | null>(null);
  const { t } = useTranslation(); // ADDED

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedReports = await adminService.getSystemReports();
        setReports(fetchedReports);
      } catch (err: any) {
        console.error('Error fetching system reports:', err);
        setError(err.message || t('failed_to_load_system_reports')); // MODIFIED
      } finally {
        setLoading(false);
      }
    };

    const fetchAuditLogs = async () => {
      setLoadingAuditLogs(true);
      setErrorAuditLogs(null);
      try {
        const fetchedLogs = await adminService.getAuditLogs();
        setAuditLogs(fetchedLogs);
      } catch (err: any) {
        console.error('Error fetching audit logs:', err);
        setErrorAuditLogs(err.message || t('failed_to_load_audit_logs')); // MODIFIED
      } finally {
        setLoadingAuditLogs(false);
      }
    };

    fetchReports();
    fetchAuditLogs();
  }, []);

  const formatLogDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-500">{t('loading_system_reports')}</p> {/* MODIFIED */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <p className="text-red-600">{t('error_label')}: {error}</p> {/* MODIFIED */}
      </div>
    );
  }

  if (!reports) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <p className="text-gray-600">{t('no_reports_data_available')}</p> {/* MODIFIED */}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="mb-6">
        <Link to="/admin" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('back_to_admin_dashboard')} {/* MODIFIED */}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('system_reports')}</h1> {/* MODIFIED */}
      <p className="text-gray-700 mb-8">{t('access_analytics_system_logs')}</p> {/* MODIFIED */}

      {/* User Statistics */}
      <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
        <Users className="h-6 w-6 mr-2 text-blue-600" /> {t('user_statistics')} {/* MODIFIED */}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">{t('total_users')}</p> {/* MODIFIED */}
            <p className="text-3xl font-bold text-gray-900">{reports.user_stats.total_users}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">{t('new_users_last_7_days')}</p> {/* MODIFIED */}
            <p className="text-3xl font-bold text-gray-900">{reports.user_stats.new_users_last_7_days}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">{t('active_users_last_30_days')}</p> {/* MODIFIED */}
            <p className="text-3xl font-bold text-gray-900">{reports.user_stats.active_users_last_30_days}</p>
          </CardBody>
        </Card>
      </div>

      {/* Contract Usage */}
      <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
        <FileText className="h-6 w-6 mr-2 text-green-600" /> {t('contract_usage')} {/* MODIFIED */}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">{t('total_contracts')}</p> {/* MODIFIED */}
            <p className="text-3xl font-bold text-gray-900">{reports.contract_stats.total_contracts}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">{t('completed_analyses')}</p> {/* MODIFIED */}
            <p className="text-3xl font-bold text-gray-900">{reports.contract_stats.completed_contracts}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">{t('failed_analyses')}</p> {/* MODIFIED */}
            <p className="text-3xl font-bold text-gray-900">{reports.contract_stats.failed_contracts}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">{t('uploaded_last_7_days')}</p> {/* MODIFIED */}
            <p className="text-3xl font-bold text-gray-900">{reports.contract_stats.contracts_uploaded_last_7_days}</p>
          </CardBody>
        </Card>
      </div>

      {/* Support & Inquiries */}
      <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
        <MessageSquare className="h-6 w-6 mr-2 text-indigo-600" /> {t('support_inquiries')} {/* MODIFIED */}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">{t('total_inquiries')}</p> {/* MODIFIED */}
            <p className="text-3xl font-bold text-gray-900">{reports.support_stats.total_inquiries}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">{t('new_inquiries_last_7_days')}</p> {/* MODIFIED */}
            <p className="text-3xl font-bold text-gray-900">{reports.support_stats.new_inquiries_last_7_days}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">{t('open_support_tickets')}</p> {/* MODIFIED */}
            <p className="text-3xl font-bold text-gray-900">{reports.support_stats.open_support_tickets}</p>
          </CardBody>
        </Card>
      </div>

      {/* Subscription Overview */}
      <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
        <DollarSign className="h-6 w-6 mr-2 text-purple-600" /> {t('subscription_overview')} {/* MODIFIED */}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">{t('active_subscriptions')}</p> {/* MODIFIED */}
            <p className="text-3xl font-bold text-gray-900">{reports.subscription_stats.active_subscriptions}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">{t('single_use_purchases')}</p> {/* MODIFIED */}
            <p className="text-3xl font-bold text-gray-900">{reports.subscription_stats.single_use_purchases}</p>
          </CardBody>
        </Card>
      </div>

      {/* Audit Logs / Recent Activity */}
      <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
        <ListChecks className="h-6 w-6 mr-2 text-red-600" /> {t('recent_activity_logs')} {/* MODIFIED */}
      </h2>
      <Card>
        <CardBody>
          {loadingAuditLogs ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-500">{t('loading_activity_logs')}</p> {/* MODIFIED */}
            </div>
          ) : errorAuditLogs ? (
            <div className="text-center py-8">
              <p className="text-red-600">{t('error_loading_activity_logs', { error: errorAuditLogs })}</p> {/* MODIFIED */}
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">{t('no_recent_activity_found')}</p> {/* MODIFIED */}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('timestamp')}</th> {/* MODIFIED */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('event_type')}</th> {/* MODIFIED */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('description')}</th> {/* MODIFIED */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('user')}</th> {/* MODIFIED */}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatLogDate(log.created_at)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t('audit_event_type_' + log.event_type)}</td> {/* MODIFIED: Translate event_type */}
                      <td className="px-6 py-4 text-sm text-gray-900">{log.description}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.user_full_name !== 'N/A' ? log.user_full_name : log.user_email}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default AdminReportsPage;