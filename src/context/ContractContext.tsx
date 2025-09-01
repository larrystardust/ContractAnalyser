import React, { createContext, useState, useContext, useEffect, useRef, ReactNode, useCallback } from 'react'; // Import useRef
import { Contract, AnalysisResult, Jurisdiction } from '../types';
import { supabase } from '../lib/supabase'; // Import your Supabase client
import { useSession } from '@supabase/auth-helpers-react'; // To get the current user session
import { RealtimeChannel } from '@supabase/supabase-js'; // Import RealtimeChannel type

interface ContractContextType {
  contracts: Contract[];
  addContract: (newContractData: { file: File; jurisdictions: Jurisdiction[]; contractText: string }) => Promise<string>;
  updateContract: (contractId: string, updates: Partial<Contract>) => Promise<void>;
  deleteContract: (contractId: string, filePath: string) => Promise<void>;
  loadingContracts: boolean;
  errorContracts: Error | null;
  refetchContracts: () => Promise<void>;
}

const ContractContext = createContext<ContractContextType | undefined>(undefined);

export const ContractProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [errorContracts, setErrorContracts] = useState<Error | null>(null);
  const session = useSession();
  const contractSubscriptionRef = useRef<RealtimeChannel | null>(null); // Use useRef for the channel

  const fetchContracts = useCallback(async () => {
    setLoadingContracts(true);
    setErrorContracts(null);
    if (!session?.user?.id) {
      setContracts([]);
      setLoadingContracts(false);
      return;
    }

    const { data, error } = await supabase
      .from('contracts')
      .select(`
        *,
        subscription_id,
        analysis_results (
          *,
          findings (*),
          jurisdiction_summaries // ADDED
        )
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contracts:', error);
      setErrorContracts(error);
    } else {
      const fetchedContracts: Contract[] = data.map((dbContract: any) => {
        const analysisResultData = dbContract.analysis_results && dbContract.analysis_results.length > 0
          ? dbContract.analysis_results[0]
          : undefined;

        return {
          id: dbContract.id,
          user_id: dbContract.user_id,
          name: dbContract.name,
          file_path: dbContract.file_path,
          size: dbContract.size,
          jurisdictions: dbContract.jurisdictions,
          status: dbContract.status,
          processing_progress: dbContract.processing_progress,
          created_at: dbContract.created_at,
          updated_at: dbContract.updated_at,
          subscription_id: dbContract.subscription_id,
          analysisResult: analysisResultData ? {
            id: analysisResultData.id,
            contract_id: analysisResultData.contract_id,
            executiveSummary: analysisResultData.executive_summary,
            dataProtectionImpact: analysisResultData.data_protection_impact,
            complianceScore: analysisResultData.compliance_score,
            created_at: analysisResultData.created_at,
            updated_at: analysisResultData.updated_at,
            findings: (analysisResultData.findings || []).map((dbFinding: any) => ({
              id: dbFinding.id,
              analysis_result_id: dbFinding.analysis_result_id,
              title: dbFinding.title,
              description: dbFinding.description,
              riskLevel: dbFinding.risk_level,
              jurisdiction: dbFinding.jurisdiction,
              category: dbFinding.category,
              recommendations: dbFinding.recommendations,
              clauseReference: dbFinding.clause_reference,
              created_at: dbFinding.created_at,
              updated_at: dbFinding.updated_at,
            })),
            jurisdictionSummaries: analysisResultData.jurisdiction_summaries || {} // ADDED
          } : undefined,
        };
      });
      setContracts(fetchedContracts);
    }
    setLoadingContracts(false);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchContracts();

    const newContractSubscription = supabase
      .channel('public:contracts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, payload => {
        fetchContracts();
      })
      .subscribe();
    contractSubscriptionRef.current = newContractSubscription; // Assign to ref

    return () => {
      // Defensive check: Only remove if the channel is defined and still active
      const currentChannel = contractSubscriptionRef.current;
      if (currentChannel && (currentChannel.state === 'joined' || currentChannel.state === 'joining')) {
        supabase.removeChannel(currentChannel);
      }
      contractSubscriptionRef.current = null; // Clear the ref
    };
  }, [fetchContracts]);

  const addContract = useCallback(async (newContractData: { file: File; jurisdictions: Jurisdiction[]; contractText: string }) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated.');
    }

    setLoadingContracts(true);
    setErrorContracts(null);

    try {
      const file = newContractData.file;
      const filePath = `${session.user.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data, error: insertError } = await supabase
        .from('contracts')
        .insert({
          user_id: session.user.id,
          name: file.name,
          file_path: filePath,
          size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          jurisdictions: newContractData.jurisdictions,
          status: 'pending',
          processing_progress: 0,
          // REMOVED: subscription_id will be set by the Edge Function
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      setContracts(prevContracts => [
        {
          ...data,
          analysisResult: undefined,
        } as Contract,
        ...prevContracts,
      ]);

      const { data: edgeFunctionData, error: edgeFunctionError } = await supabase.functions.invoke('contract-analyzer', {
        body: {
          contract_id: data.id,
          contract_text: newContractData.contractText,
        },
      });

      if (edgeFunctionError) {
        console.error('Error invoking Edge Function:', edgeFunctionError);
        await supabase.from('contracts').update({ status: 'failed' }).eq('id', data.id);
      } else {
        console.log('Edge Function invoked successfully:', edgeFunctionData);
      }
      return data.id;
    } catch (error: any) {
      console.error('Error adding contract:', error);
      setErrorContracts(error);
      throw error;
    } finally {
      setLoadingContracts(false);
    }
  }, [session?.user?.id]);

  const updateContract = useCallback(async (contractId: string, updates: Partial<Contract>) => {
    setLoadingContracts(true);
    setErrorContracts(null);
    try {
      const { error } = await supabase
        .from('contracts')
        .update(updates)
        .eq('id', contractId);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Error updating contract:', error);
      setErrorContracts(error);
      throw error;
    } finally {
      setLoadingContracts(false);
    }
  }, []);

  const deleteContract = useCallback(async (contractId: string, filePath: string) => {
    setLoadingContracts(true);
    setErrorContracts(null);
    try {
      // 1. Delete file from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('contracts')
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        throw storageError;
      }

      // 2. Delete contract record from 'contracts' table
      // This should cascade delete analysis_results and findings due to foreign key constraints
      const { error: dbError } = await supabase
        .from('contracts')
        .delete()
        .eq('id', contractId);

      if (dbError) {
        console.error('Error deleting contract from database:', dbError);
        throw dbError;
      }

      // Optimistically update UI or rely on real-time subscription
      setContracts(prevContracts => prevContracts.filter(contract => contract.id !== contractId));
      console.log(`Contract ${contractId} and its file deleted successfully.`);
    } catch (error: any) {
      console.error('Error deleting contract:', error);
      setErrorContracts(error);
      throw error;
    } finally {
      setLoadingContracts(false);
    }
  }, []);

  const refetchContracts = useCallback(async () => {
    await fetchContracts();
  }, [fetchContracts]);

  return (
    <ContractContext.Provider value={{ contracts, addContract, updateContract, deleteContract, loadingContracts, errorContracts, refetchContracts }}>
      {children}
    </ContractContext.Provider>
  );
};

export const useContracts = () => {
  const context = useContext(ContractContext);
  if (context === undefined) {
    throw new Error('useContracts must be used within a ContractProvider');
  }
  return context;
};