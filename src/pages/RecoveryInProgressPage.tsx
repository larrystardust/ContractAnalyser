import React from 'react';
import { Link } from 'react-router-dom';
import Card, { CardBody } from '../components/ui/Card';
import { AlertTriangle, Lock } from 'lucide-react';

const RecoveryInProgressPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardBody className="text-center">
          <Lock className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset In Progress</h2>
          <p className="text-gray-600 mb-6">
            It looks like you've initiated a password reset process in another browser tab or window.
            For your security, please complete the password reset in the original tab.
          </p>
          <p className="text-gray-600 mb-6">
            Once the password reset is complete, you can log in with your new credentials.
          </p>
          <Link to="/login">
            <button className="inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-blue-900 text-white hover:bg-blue-800 focus:ring-blue-500 text-base px-6 py-3 w-full">
              Go to Login Page
            </button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
};

export default RecoveryInProgressPage;