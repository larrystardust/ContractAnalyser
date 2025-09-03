import React, { useEffect } from 'react'; // ADDED useEffect
import { useNavigate } from 'react-router-dom'; // ADDED useNavigate
import { CheckCircle } from 'lucide-react';
// REMOVED: import Button from '../ui/Button'; // Button is no longer needed for navigation

const CheckoutSuccess: React.FC = () => {
  const navigate = useNavigate(); // Initialize useNavigate

  useEffect(() => {
    // Redirect to the upload page after 3 seconds
    const timer = setTimeout(() => {
      navigate('/upload');
    }, 3000); // 3000 milliseconds = 3 seconds

    // Cleanup the timer if the component unmounts before the redirect
    return () => clearTimeout(timer);
  }, [navigate]); // Dependency array ensures effect runs once on mount

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
          <CheckCircle className="h-6 w-6 text-green-600" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Successful!
        </h2>
        
        <p className="text-gray-600 mb-6">
          Thank you for your purchase. Your payment has been processed successfully.
          You will be redirected to the upload page shortly.
        </p>
        
        {/* REMOVED: Link component as redirection is now automatic */}
        {/* <Link to="/upload">
          <Button variant="primary" size="lg" className="w-full">
            Return to Upload Page
          </Button>
        </Link> */}
      </div>
    </div>
  );
};

export default CheckoutSuccess;