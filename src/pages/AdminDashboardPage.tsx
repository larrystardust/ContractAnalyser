import React from 'react';
import { Link } from 'react-router-dom';
import Card, { CardBody } from '../components/ui/Card';
import { Users, FileText, Settings, BarChart, MessageSquare, LifeBuoy } from 'lucide-react';

const AdminDashboardPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
      <p className="text-gray-700 mb-8">Welcome, Administrator! From here, you can manage various aspects of the application.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link to="/admin/users">
          <Card hoverable>
            <CardBody className="text-center">
              <Users className="h-12 w-12 text-blue-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900">Manage Users</h2>
              <p className="text-gray-600 text-sm mt-1">View, edit, and delete user accounts.</p>
            </CardBody>
          </Card>
        </Link>

        <Link to="/admin/contracts"> {/* UPDATED: Link to AdminContractsPage */}
          <Card hoverable>
            <CardBody className="text-center">
              <FileText className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900">Manage Contracts</h2>
              <p className="text-gray-600 text-sm mt-1">Oversee all uploaded contracts and analysis results.</p>
            </CardBody>
          </Card>
        </Link>

        <Link to="/admin/inquiries">
          <Card hoverable>
            <CardBody className="text-center">
              <MessageSquare className="h-12 w-12 text-indigo-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900">Manage Inquiries</h2>
              <p className="text-gray-600 text-sm mt-1">View messages submitted through the contact form.</p>
            </CardBody>
          </Card>
        </Link>

        <Link to="/admin/support-tickets">
          <Card hoverable>
            <CardBody className="text-center">
              <LifeBuoy className="h-12 w-12 text-red-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900">Manage Support Tickets</h2>
              <p className="text-gray-600 text-sm mt-1">Handle user support requests.</p>
            </CardBody>
          </Card>
        </Link>

        <Link to="/admin/settings"> {/* UPDATED: Link to AdminSettingsPage */}
          <Card hoverable>
            <CardBody className="text-center">
              <Settings className="h-12 w-12 text-purple-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900">Application Settings</h2>
              <p className="text-gray-600 text-sm mt-1">Configure global application parameters.</p>
            </CardBody>
          </Card>
        </Link>

        <Link to="/admin/reports"> {/* UPDATED: Link to AdminReportsPage */}
          <Card hoverable>
            <CardBody className="text-center">
              <BarChart className="h-12 w-12 text-orange-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900">System Reports</h2>
              <p className="text-gray-600 text-sm mt-1">Access analytics and system logs.</p>
            </CardBody>
          </Card>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboardPage;