import React from 'react';
import { Contract } from '../../types';
import Card, { CardBody } from '../ui/Card';
import { JurisdictionBadge } from '../ui/Badge';
import { FileText, Clock, AlertTriangle, CheckCircle } from 'lucide-react'; // REMOVED: Trash2, Download
import { useNavigate } from 'react-router-dom';
// REMOVED: useContracts and useSupabaseClient imports as they are not needed for a static sample

interface SampleContractListProps { // MODIFIED: Renamed interface
  contractsToDisplay?: Contract[];
  onSelectContract?: (contractId: string) => void;
}

const SampleContractList: React.FC<SampleContractListProps> = ({ contractsToDisplay, onSelectContract }) => { // MODIFIED: Renamed component
  // REMOVED: const { contracts, deleteContract } = useContracts();
  // REMOVED: const supabase = useSupabaseClient();
  const navigate = useNavigate();

  const contractsToRender = contractsToDisplay; // MODIFIED: Always use contractsToDisplay for sample list

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-gray-500" />;
      case 'analyzing':
        return <AlertTriangle className="h-5 w-5 text-amber-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'analyzing':
        return 'Analyzing';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  // REMOVED: handleDelete function
  // REMOVED: handleDownload function

  return (
    <div className="space-y-4">
      {/* REMOVED: Conditional rendering for "Your Contracts" heading */}
      
      {contractsToRender.length === 0 ? (
        <Card>
          <CardBody className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No contracts found</p>
            <p className="text-sm text-gray-400 mt-1">Select a sample contract to view its analysis</p> {/* MODIFIED: Specific message for sample */}
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {contractsToRender.map((contract) => (
            <Card 
              key={contract.id} 
              hoverable={true}
              onClick={() => {
                if (onSelectContract) {
                  onSelectContract(contract.id);
                } else {
                  // This else block should ideally not be hit if onSelectContract is always provided for sample
                  navigate(`/dashboard?contractId=${contract.id}`);
                }
              }}
              className={`transition-all duration-200 border border-gray-100`}
            >
              <CardBody className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="flex-shrink-0 mr-4">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-blue-900" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{contract.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(contract.created_at)} • {contract.size}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {contract.jurisdictions.map((jurisdiction) => (
                        <JurisdictionBadge 
                          key={jurisdiction} 
                          jurisdiction={jurisdiction} 
                          showLabel={false}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Group status vertically */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center px-3 py-1 rounded-full bg-gray-100">
                      {getStatusIcon(contract.status)}
                      <span className="ml-1 text-xs font-medium text-gray-700">
                        {getStatusLabel(contract.status)}
                      </span>
                    </div>
                    {contract.status === 'analyzing' && contract.processing_progress !== undefined && (
                      <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-2">
                        <div 
                          className="bg-blue-600 h-1.5 rounded-full" 
                          style={{ width: `${contract.processing_progress}%` }}
                        ></div>
                      </div>
                    )}
                    {/* REMOVED: Download Button */}
                  </div>
                  {/* REMOVED: Delete Button */}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SampleContractList;