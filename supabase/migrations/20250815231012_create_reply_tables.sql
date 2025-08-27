-- Create inquiry_replies table
CREATE TABLE public.inquiry_replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id uuid NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
    admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reply_message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create support_ticket_replies table
CREATE TABLE public.support_ticket_replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reply_message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS) for new tables
ALTER TABLE public.inquiry_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for inquiry_replies
CREATE POLICY "Admins can view all inquiry replies."
ON public.inquiry_replies FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "Admins can insert inquiry replies."
ON public.inquiry_replies FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- Create RLS policies for support_ticket_replies
CREATE POLICY "Admins can view all support ticket replies."
ON public.support_ticket_replies FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "Admins can insert support ticket replies."
ON public.support_ticket_replies FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));