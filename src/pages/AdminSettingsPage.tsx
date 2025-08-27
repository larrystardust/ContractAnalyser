import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import Card, { CardBody } from '../components/ui/Card';

const AdminSettingsPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="mb-6">
        <Link to="/admin" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">Application Settings</h1>
      <p className="text-gray-700 mb-8">This page will allow administrators to configure global application parameters.</p>

      <Card>
        <CardBody className="text-center py-8">
          <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Application settings features coming soon!</p>
        </CardBody>
      </Card>
    </div>
  );
};

export default AdminSettingsPage;