import React, { createContext, useState, useContext, useEffect, useRef, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useSession } from '@supabase/auth-helpers-react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Contract, AnalysisResult, Jurisdiction, AnalysisLanguage } from '../types'; // MODIFIED: Import AnalysisLanguage

interface ContractContextType {
  // MODIFIED: Update addContract signature to include files (array) and imageDatas (array)
  addContract: (newContractData: {
    files?: File[]; // MODIFIED: Array of files
    imageDatas?: string[]; // MODIFIED: Array of Base64 image data
    fileName: string;
    fileSize: string;
    fileType: string;
    jurisdictions: Jurisdiction[];
    contractText: string;
    sourceLanguage: AnalysisLanguage;
    outputLanguage: AnalysisLanguage;
    performOcr: boolean; // Whether OCR should be performed on backend
    performAnalysis: boolean; // Whether analysis should be performed on backend
    creditCost: number; // Total credits to deduct for this operation
  }) => Promise<string>;
  updateContract: (contractId: string, updates: Partial<Contract>) => Promise<void>;
  deleteContract: (contractId: string, filePath: string) => Promise<void>;
  reanalyzeContract: (contractId: string) => Promise<void>;
  loadingContracts: boolean;
  errorContracts: Error | null;
  refetchContracts: () => Promise<void>;
}

const ContractContext = createContext<ContractContextType | undefined>(undefined);

export const ContractProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [errorContracts, setErrorContracts] = useState<Error | null>(null);
  const session = useSession();
  const contractSubscriptionRef = useRef<RealtimeChannel | null>(null);

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
        contract_content,
        output_language,
        translated_name,
        analysis_results (*, findings(*))
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contracts:', error);
      setErrorContracts(error);
    } else {
      const fetchedContracts: Contract[] = data.map((dbContract: any) => {
        const sortedAnalysisResults = dbContract.analysis_results
          ? [...dbContract.analysis_results].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          : [];
        
        const analysisResultData = sortedAnalysisResults.length > 0
          ? sortedAnalysisResults[0]
          : undefined;

        return {
          id: dbContract.id,
          user_id: dbContract.user_id,
          name: dbContract.name,
          translated_name: dbContract.translated_name, // ADDED
          file_path: dbContract.file_path,
          size: dbContract.size, // Keep as string
          jurisdictions: dbContract.jurisdictions,
          status: dbContract.status,
          processing_progress: dbContract.processing_progress,
          created_at: dbContract.created_at,
          updated_at: dbContract.updated_at,
          subscription_id: dbContract.subscription_id,
          contract_content: dbContract.contract_content,
          output_language: dbContract.output_language, // ADDED
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
            reportFilePath: analysisResultData.report_file_path,
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

  // MODIFIED: Update addContract function to accept files (array) and imageDatas (array)
  const addContract = useCallback(async (newContractData: {
    files?: File[]; // MODIFIED
    imageDatas?: string[]; // MODIFIED
    fileName: string;
    fileSize: string;
    fileType: string;
    jurisdictions: Jurisdiction[];
    contractText: string;
    sourceLanguage: AnalysisLanguage;
    outputLanguage: AnalysisLanguage;
    performOcr: boolean;
    performAnalysis: boolean;
    creditCost: number;
  }) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated.');
    }

    setLoadingContracts(true);
    setErrorContracts(null);

    try {
      let filePath = '';
      let filePaths: string[] = []; // ADDED: To store multiple file paths
      let fileContentBase64: string | undefined; // This will hold the Base64 data for OCR if needed

      // Handle file upload to storage first
      if (newContractData.files && newContractData.files.length > 0) {
        for (const file of newContractData.files) {
          const currentFilePath = `${session.user.id}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('contracts')
            .upload(currentFilePath, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            throw uploadError;
          }
          filePaths.push(currentFilePath);
        }
        filePath = filePaths[0]; // Store the first file path as the main one for the contract record
      } else if (newContractData.imageDatas && newContractData.imageDatas.length > 0) {
        // This branch is for capturedImageData (from camera)
        // Upload each image to storage
        for (let i = 0; i < newContractData.imageDatas.length; i++) {
          const imageData = newContractData.imageDatas[i];
          const currentFilePath = `${session.user.id}/${Date.now()}-scanned_document_${i + 1}.jpeg`;
          
          // Ensure imageData is correctly formatted Base64
          let base64Data = imageData;
          if (imageData.startsWith('data:')) {
            base64Data = imageData.split(',')[1];
          }
          
          const imageBlob = await fetch(imageData).then(res => res.blob());
          const { error: uploadError } = await supabase.storage
            .from('contracts')
            .upload(currentFilePath, imageBlob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            console.warn('Error uploading captured image to storage:', uploadError);
            // Don't throw, continue with OCR if possible
          }
          filePaths.push(currentFilePath);
        }
        filePath = filePaths[0]; // Store the first image path as the main one for the contract record
      } else {
        // If no file and no capturedImageData, then contractText must be present for processing
        if (!newContractData.contractText) {
          throw new Error('No file, image, or contract text provided for upload.');
        }
      }

      const { data, error: insertError } = await supabase
        .from('contracts')
        .insert({
          user_id: session.user.id,
          name: newContractData.fileName,
          file_path: filePath, // Store the first file path
          size: newContractData.fileSize,
          jurisdictions: newContractData.jurisdictions,
          status: 'pending',
          processing_progress: 0,
          contract_content: newContractData.contractText, // Will be empty if OCR is performed on backend
          output_language: newContractData.outputLanguage,
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

      // DEBUG: Log the payload before invoking the Edge Function
      console.log('Invoking contract-analyzer with payload:');
      console.log('  contract_id:', data.id);
      console.log('  contract_text (length):', newContractData.contractText.length);
      console.log('  image_datas (present):', newContractData.imageDatas && newContractData.imageDatas.length > 0); // MODIFIED
      console.log('  image_datas (count):', newContractData.imageDatas?.length); // MODIFIED
      console.log('  perform_ocr_flag:', newContractData.performOcr);
      console.log('  perform_analysis:', newContractData.performAnalysis);
      console.log('  credit_cost:', newContractData.creditCost);

      // MODIFIED: Pass imageDatas (array), performOcr, performAnalysis, creditCost to Edge Function
      const { data: edgeFunctionData, error: edgeFunctionError } = await supabase.functions.invoke('contract-analyzer', {
        body: {
          contract_id: data.id,
          contract_text: newContractData.contractText, // Will be empty if OCR is performed on backend
          image_datas: newContractData.imageDatas, // MODIFIED: Pass array of Base64 image data
          source_language: newContractData.sourceLanguage,
          output_language: newContractData.outputLanguage,
          original_contract_name: newContractData.fileName,
          perform_ocr_flag: newContractData.performOcr,
          perform_analysis: newContractData.performAnalysis,
          credit_cost: newContractData.creditCost,
        },
      });

      if (edgeFunctionError) {
        console.error('Error invoking Edge Function:', edgeFunctionError);
        await supabase.from('contracts').update({ status: 'failed' }).eq('id', data.id);
      } else {
        if (edgeFunctionData?.translated_contract_name) {
          await supabase.from('contracts').update({ translated_name: edgeFunctionData.translated_contract_name }).eq('id', data.id);
        }
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
          // console.log(`Successfully deleted original contract file: ${filePath}`); // REMOVED
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
          // console.log(`Successfully deleted report file: ${filePath}`); // REMOVED
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

      setContracts(prevContracts => prevContracts.filter(contract => contract.id !== contractId));
      // console.log(`Contract ${contractId} and its associated files deleted successfully.`); // REMOVED
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

    try {
      setContracts(prevContracts =>
        prevContracts.map(contract =>
          contract.id === contractId
            ? { ...contract, status: 'analyzing', processing_progress: 0, analysisResult: undefined }
            : contract
        )
      );

      const { data, error } = await supabase.functions.invoke('re-analyze-contract', {
        body: {
          contract_id: contractId,
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('ContractContext: Error from re-analyze-contract:', error);

        let userFacingMessage = 'An unexpected error occurred during contract re-analysis. Please try again or contact support.';

        if (error.name === 'FunctionsHttpError' && error.context) {
          if (error.context.status === 403) {
            userFacingMessage = 'You do not have credits to re-analyze this contract. Please purchase a single-use or subscription plan.';
            try {
              const errorBody = await error.context.json();
              // console.log('ContractContext: Parsed 403 error body for logging:', errorBody); // REMOVED
            } catch (parseError) {
              console.warn('ContractContext: Could not parse 403 error response body for logging:', parseError);
            }
          }
          else if (error.message.includes('Edge Function returned a non-2xx status code')) {
            userFacingMessage = 'An unexpected error occurred during contract re-analysis. Please try again or contact support.';
            try {
              const errorBody = await error.context.json();
              // console.log('ContractContext: Parsed non-403 FunctionsHttpError body for logging:', errorBody); // REMOVED
            } catch (parseError) {
              console.warn('ContractContext: Could not parse non-403 FunctionsHttpError response body for logging:', parseError);
            }
          }
          else if (error.context.error) {
            userFacingMessage = error.context.error;
          }
        }
        else if (error.message) {
          userFacingMessage = error.message;
        }

        throw new Error(userFacingMessage);
      }

      // console.log('Re-analysis initiated:', data); // REMOVED
    } catch (error: any) {
      console.error('Error re-analyzing contract:', error);
      setContracts(prevContracts =>
        prevContracts.map(contract =>
          contract.id === contractId
            ? { ...contract, status: 'failed', processing_progress: 0 }
            : contract
        )
      );
      throw error;
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