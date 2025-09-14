import React from 'react';
import { Link } from 'react-router-dom';
import Card, { CardBody } from '../components/ui/Card';
import { Users, FileText, Settings, BarChart, MessageSquare, LifeBuoy } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ADDED

const AdminDashboardPage: React.FC = () => {
  const { t } = useTranslation(); // ADDED

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('admin_dashboard')}</h1> {/* MODIFIED */}
      <p className="text-gray-700 mb-8">{t('welcome_admin_dashboard')}</p> {/* MODIFIED */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link to="/admin/users">
          <Card hoverable>
            <CardBody className="text-center">
              <Users className="h-12 w-12 text-blue-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900">{t('manage_users')}</h2> {/* MODIFIED */}
              <p className="text-gray-600 text-sm mt-1">{t('view_edit_delete_users')}</p> {/* MODIFIED */}
            </CardBody>
          </Card>
        </Link>

        <Link to="/admin/contracts">
          <Card hoverable>
            <CardBody className="text-center">
              <FileText className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900">{t('manage_contracts')}</h2> {/* MODIFIED */}
              <p className="text-gray-600 text-sm mt-1">{t('oversee_contracts_analysis')}</p> {/* MODIFIED */}
            </CardBody>
          </Card>
        </Link>

        <Link to="/admin/inquiries">
          <Card hoverable>
            <CardBody className="text-center">
              <MessageSquare className="h-12 w-12 text-indigo-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900">{t('manage_inquiries')}</h2> {/* MODIFIED */}
              <p className="text-gray-600 text-sm mt-1">{t('view_messages_contact_form')}</p> {/* MODIFIED */}
            </CardBody>
          </Card>
        </Link>

        <Link to="/admin/support-tickets">
          <Card hoverable>
            <CardBody className="text-center">
              <LifeBuoy className="h-12 w-12 text-red-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900">{t('manage_support_tickets')}</h2> {/* MODIFIED */}
              <p className="text-gray-600 text-sm mt-1">{t('handle_user_support_requests')}</p> {/* MODIFIED */}
            </CardBody>
          </Card>
        </Link>

        <Link to="/admin/settings">
          <Card hoverable>
            <CardBody className="text-center">
              <Settings className="h-12 w-12 text-purple-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900">{t('application_settings')}</h2> {/* MODIFIED */}
              <p className="text-gray-600 text-sm mt-1">{t('configure_global_parameters')}</p> {/* MODIFIED */}
            </CardBody>
          </Card>
        </Link>

        <Link to="/admin/reports">
          <Card hoverable>
            <CardBody className="text-center">
              <BarChart className="h-12 w-12 text-orange-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900">{t('system_reports')}</h2> {/* MODIFIED */}
              <p className="text-gray-600 text-sm mt-1">{t('access_analytics_system_logs')}</p> {/* MODIFIED */}
            </CardBody>
          </Card>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboardPage;