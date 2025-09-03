import React, { createContext, useState, useContext, useEffect, useRef, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useSession } from '@supabase/auth-helpers-react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Contract, AnalysisResult, Jurisdiction } from '../types'; // Ensure these types are correctly imported

interface ContractContextType {
  contracts: Contract[];
  addContract: (newContractData: { file: File; jurisdictions: Jurisdiction[]; contractText: string }) => Promise<string>;
  updateContract: (contractId: string, updates: Partial<Contract>) => Promise<void>;
  deleteContract: (contractId: string, filePath: string) => Promise<void>;
  reanalyzeContract: (contractId: string) => Promise<void>;
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
  const contractSubscriptionRef = useRef<RealtimeChannel | null>(null);

  const fetchContracts = useCallback(async () => {
    setLoadingContracts(true);
    setErrorContracts(null); // Clear any previous errors when fetching
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
        contract_content,
        analysis_results (
          *,
          findings (*),
          jurisdiction_summaries,
          report_file_path
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
          contract_content: dbContract.contract_content,
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
            jurisdictionSummaries: analysisResultData.jurisdiction_summaries || {},
            reportFilePath: analysisResultData.report_file_path || null,
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
    contractSubscriptionRef.current = newContractSubscription;

    return () => {
      const currentChannel = contractSubscriptionRef.current;
      if (currentChannel && (currentChannel.state === 'joined' || currentChannel.state === 'joining')) {
        supabase.removeChannel(currentChannel);
      }
      contractSubscriptionRef.current = null;
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
          contract_content: newContractData.contractText,
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
      // 1. Fetch analysis result to get report_file_path
      const { data: analysisResultData, error: fetchAnalysisError } = await supabase
        .from('analysis_results')
        .select('report_file_path')
        .eq('contract_id', contractId)
        .maybeSingle();

      if (fetchAnalysisError) {
        console.error('Error fetching analysis result for deletion:', fetchAnalysisError);
        // Don't throw, try to delete other files anyway
      }

      const reportFilePath = analysisResultData?.report_file_path;

      // 2. Delete original contract file from Supabase Storage
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('contracts')
          .remove([filePath]);

        if (storageError) {
          console.error('Error deleting original contract file from storage:', storageError);
          // Don't throw, try to delete the DB record anyway
        } else {
          console.log(`Successfully deleted original contract file: ${filePath}`);
        }
      }

      // 3. Delete report file from Supabase Storage if it exists
      if (reportFilePath) {
        const { error: reportStorageError } = await supabase.storage
          .from('reports')
          .remove([reportFilePath]);

        if (reportStorageError) {
          console.error('Error deleting report file from storage:', reportStorageError);
        } else {
          console.log(`Successfully deleted report file: ${reportFilePath}`);
        }
      }

      // 4. Delete contract record from 'contracts' table
      // This should cascade delete analysis_results and findings due to foreign key constraints
      const { error: dbError } = await supabase
        .from('contracts')
        .delete()
        .eq('id', contractId);

      if (dbError) {
        console.error('Error deleting contract record from database:', dbError);
        throw dbError;
      }

      // Optimistically update UI or rely on real-time subscription
      setContracts(prevContracts => prevContracts.filter(contract => contract.id !== contractId));
      console.log(`Contract ${contractId} and its associated files deleted successfully.`);
    } catch (error: any) {
      console.error('Error deleting contract:', error);
      setErrorContracts(error);
      throw error;
    } finally {
      setLoadingContracts(false);
    }
  }, []);

  const reanalyzeContract = useCallback(async (contractId: string) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated.');
    }
    setLoadingContracts(true);
    // DO NOT set setErrorContracts here, let the calling component handle the specific error message
    // setErrorContracts(null); // This line is removed

    try {
      const { data, error } = await supabase.functions.invoke('re-analyze-contract', {
        body: { contract_id: contractId },
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('ContractContext: Error from re-analyze-contract:', error); // Log the full error object

        // Check if the error is a FunctionsHttpError with a 403 status
        if (error.name === 'FunctionsHttpError' && error.context && error.context.status === 403) {
          let errorMessage = 'You do not have credits to re-analyze this contract. Please purchase a single-use or subscription plan.';
          try {
            // Attempt to read the response body for a more specific message from the Edge Function
            // This part is for logging/debugging, but the thrown error will use the hardcoded message
            const errorBody = await error.context.json();
            console.log('ContractContext: Parsed 403 error body:', errorBody); // Log parsed body
            // If errorBody.error exists and is more specific, we could use it,
            // but for this specific user request, we want the *exact* message.
            // So, we'll stick to the hardcoded errorMessage for the thrown error.
          } catch (parseError) {
            console.warn('ContractContext: Could not parse re-analyze-contract 403 error response body:', parseError);
          }
          throw new Error(errorMessage); // Always throw the specific user-friendly message
        }
        throw error; // Re-throw other types of errors
      }

      console.log('Re-analysis initiated:', data);
      setContracts(prevContracts =>
        prevContracts.map(contract =>
          contract.id === contractId ? { ...contract, status: 'analyzing', processing_progress: 0 } : contract
        )
      );
      // DO NOT alert here, let the calling component handle the success message
      // alert('Re-analysis started. Please check your dashboard for updates.'); // This line is removed
    } catch (error: any) {
      console.error('Error re-analyzing contract:', error);
      // DO NOT set setErrorContracts here, let the calling component handle the specific error message
      // setErrorContracts(error); // This line is removed
      throw error; // Re-throw the error so the calling component can catch it
    } finally {
      setLoadingContracts(false);
    }
  }, [session?.user?.id]);


  const refetchContracts = useCallback(async () => {
    await fetchContracts();
  }, [fetchContracts]);

  return (
    <ContractContext.Provider value={{ contracts, addContract, updateContract, deleteContract, reanalyzeContract, loadingContracts, errorContracts, refetchContracts }}>
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