import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart, Users, FileText, MessageSquare, LifeBuoy, DollarSign, Loader2 } from 'lucide-react';
import Card, { CardBody } from '../components/ui/Card';
import adminService, { SystemReports } from '../services/adminService'; // Import SystemReports type

const AdminReportsPage: React.FC = () => {
  const [reports, setReports] = useState<SystemReports | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedReports = await adminService.getSystemReports();
        setReports(fetchedReports);
      } catch (err: any) {
        console.error('Error fetching system reports:', err);
        setError(err.message || 'Failed to load system reports.');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Loading system reports...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  if (!reports) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <p className="text-gray-600">No reports data available.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="mb-6">
        <Link to="/admin" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">System Reports</h1>
      <p className="text-gray-700 mb-8">Access key analytics and insights into application usage.</p>

      {/* User Statistics */}
      <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
        <Users className="h-6 w-6 mr-2 text-blue-600" /> User Statistics
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">Total Users</p>
            <p className="text-3xl font-bold text-gray-900">{reports.user_stats.total_users}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">New Users (Last 7 Days)</p>
            <p className="text-3xl font-bold text-gray-900">{reports.user_stats.new_users_last_7_days}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">Active Users (Last 30 Days Login)</p>
            <p className="text-3xl font-bold text-gray-900">{reports.user_stats.active_users_last_30_days}</p>
          </CardBody>
        </Card>
      </div>

      {/* Contract Usage */}
      <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
        <FileText className="h-6 w-6 mr-2 text-green-600" /> Contract Usage
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">Total Contracts</p>
            <p className="text-3xl font-bold text-gray-900">{reports.contract_stats.total_contracts}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">Completed Analyses</p>
            <p className="text-3xl font-bold text-gray-900">{reports.contract_stats.completed_contracts}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">Failed Analyses</p>
            <p className="text-3xl font-bold text-gray-900">{reports.contract_stats.failed_contracts}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">Uploaded (Last 7 Days)</p>
            <p className="text-3xl font-bold text-gray-900">{reports.contract_stats.contracts_uploaded_last_7_days}</p>
          </CardBody>
        </Card>
      </div>

      {/* Support & Inquiries */}
      <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
        <MessageSquare className="h-6 w-6 mr-2 text-indigo-600" /> Support & Inquiries
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">Total Inquiries</p>
            <p className="text-3xl font-bold text-gray-900">{reports.support_stats.total_inquiries}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">New Inquiries (Last 7 Days)</p>
            <p className="text-3xl font-bold text-gray-900">{reports.support_stats.new_inquiries_last_7_days}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">Open Support Tickets</p>
            <p className="text-3xl font-bold text-gray-900">{reports.support_stats.open_support_tickets}</p>
          </CardBody>
        </Card>
      </div>

      {/* Subscription Overview */}
      <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
        <DollarSign className="h-6 w-6 mr-2 text-purple-600" /> Subscription Overview
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">Active Subscriptions</p>
            <p className="text-3xl font-bold text-gray-900">{reports.subscription_stats.active_subscriptions}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-gray-600">Single-Use Purchases</p>
            <p className="text-3xl font-bold text-gray-900">{reports.subscription_stats.single_use_purchases}</p>
          </CardBody>
        </Card>
      </div>

      {/* Placeholder for System Logs */}
      <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
        <LifeBuoy className="h-6 w-6 mr-2 text-red-600" /> System Logs
      </h2>
      <Card>
        <CardBody className="text-center py-8">
          <BarChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Detailed system logs and advanced analytics features are under development.</p>
          <p className="text-gray-500 mt-2">For direct access to Supabase logs, please refer to your Supabase project dashboard.</p>
        </CardBody>
      </Card>
    </div>
  );
};

export default AdminReportsPage;