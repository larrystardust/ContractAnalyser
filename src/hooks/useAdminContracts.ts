import { useState, useEffect, useCallback } from 'react';
import adminService, { AdminContract } from '../services/adminService';

export function useAdminContracts() {
  const [contracts, setContracts] = useState<AdminContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedContracts = await adminService.getAllContractsForAdmin();
      setContracts(fetchedContracts);
    } catch (err: any) {
      console.error('Error fetching admin contracts:', err);
      setError(err.message || 'Failed to load contracts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const deleteContract = useCallback(async (contractId: string) => {
    setLoading(true); // Show loading state during deletion
    setError(null);
    try {
      await adminService.deleteContractAsAdmin(contractId);
      setContracts(prevContracts => prevContracts.filter(contract => contract.id !== contractId));
      return true; // Indicate success
    } catch (err: any) {
      console.error('Error deleting contract as admin:', err);
      setError(err.message || 'Failed to delete contract.');
      return false; // Indicate failure
    } finally {
      setLoading(false);
    }
  }, []);

  const markContractForDeletion = useCallback(async (contractId: string, marked: boolean) => {
    setLoading(true); // Show loading state during update
    setError(null);
    try {
      await adminService.markContractForDeletionAsAdmin(contractId, marked);
      setContracts(prevContracts =>
        prevContracts.map(contract =>
          contract.id === contractId ? { ...contract, marked_for_deletion_by_admin: marked } : contract
        )
      );
      return true; // Indicate success
    } catch (err: any) {
      console.error('Error marking contract for deletion as admin:', err);
      setError(err.message || 'Failed to update contract deletion status.');
      return false; // Indicate failure
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    contracts,
    loading,
    error,
    fetchContracts,
    deleteContract,
    markContractForDeletion,
  };
}