-- Add a column to mark subscriber files for deletion by admin
ALTER TABLE public.contracts
ADD COLUMN marked_for_deletion_by_admin BOOLEAN DEFAULT FALSE;

-- Optional: Add an index if this column will be frequently queried
CREATE INDEX idx_contracts_marked_for_deletion_by_admin ON public.contracts (marked_for_deletion_by_admin);