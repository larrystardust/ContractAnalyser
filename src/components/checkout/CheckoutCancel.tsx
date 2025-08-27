import React from 'react';
import { Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import Button from '../ui/Button';

const CheckoutCancel: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
          <XCircle className="h-6 w-6 text-red-600" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Cancelled
        </h2>
        
        <p className="text-gray-600 mb-6">
          Your payment was cancelled. No charges were made to your account.
        </p>
        
        <Link to="/pricing">
          <Button variant="primary" size="lg" className="w-full">
            Return to Pricing
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default CheckoutCancel;