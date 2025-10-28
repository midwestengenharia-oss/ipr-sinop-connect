-- Create enums for roles and types
CREATE TYPE app_role AS ENUM ('admin', 'leader', 'member');
CREATE TYPE minute_type AS ENUM ('conselho', 'assembleia', 'ministerio', 'celula', 'outro');
CREATE TYPE minute_status AS ENUM ('em_andamento', 'assinada_arquivada');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'member',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create cells table
CREATE TABLE public.cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  leader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  co_leader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  neighborhood TEXT,
  meeting_day TEXT,
  meeting_time TIME,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on cells
ALTER TABLE public.cells ENABLE ROW LEVEL SECURITY;

-- Cells RLS policies
CREATE POLICY "Everyone can view cells"
  ON public.cells FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage all cells"
  ON public.cells FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Leaders can manage their own cells"
  ON public.cells FOR UPDATE
  USING (
    leader_id = auth.uid() OR co_leader_id = auth.uid()
  );

-- Create cell_members table
CREATE TABLE public.cell_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id UUID NOT NULL REFERENCES public.cells(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cell_id, member_id)
);

-- Enable RLS on cell_members
ALTER TABLE public.cell_members ENABLE ROW LEVEL SECURITY;

-- Cell members RLS policies
CREATE POLICY "Everyone can view cell members"
  ON public.cell_members FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage all cell members"
  ON public.cell_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Leaders can manage members of their cells"
  ON public.cell_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cells
      WHERE id = cell_id 
      AND (leader_id = auth.uid() OR co_leader_id = auth.uid())
    )
  );

-- Create minutes table
CREATE TABLE public.minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  type minute_type NOT NULL,
  date DATE NOT NULL,
  location TEXT NOT NULL,
  responsible_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  pdf_url TEXT,
  status minute_status NOT NULL DEFAULT 'em_andamento',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on minutes
ALTER TABLE public.minutes ENABLE ROW LEVEL SECURITY;

-- Minutes RLS policies
CREATE POLICY "Admins and leaders can view all minutes"
  ON public.minutes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'leader')
    )
  );

CREATE POLICY "Admins can manage all minutes"
  ON public.minutes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id UUID NOT NULL REFERENCES public.cells(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  present BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cell_id, member_id, meeting_date)
);

-- Enable RLS on attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Attendance RLS policies
CREATE POLICY "Everyone can view attendance"
  ON public.attendance FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage all attendance"
  ON public.attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Leaders can manage attendance of their cells"
  ON public.attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cells
      WHERE id = cell_id 
      AND (leader_id = auth.uid() OR co_leader_id = auth.uid())
    )
  );

-- Create function for automatic minute numbering
CREATE OR REPLACE FUNCTION generate_minute_number()
RETURNS TEXT AS $$
DECLARE
  last_number INT;
  new_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 'ATA-([0-9]+)') AS INT)), 0)
  INTO last_number
  FROM public.minutes;
  
  new_number := 'ATA-' || LPAD((last_number + 1)::TEXT, 3, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updated_at on profiles
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cells_updated_at
  BEFORE UPDATE ON public.cells
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_minutes_updated_at
  BEFORE UPDATE ON public.minutes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for auto-creating profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    'member'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for minutes PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('minutes-pdfs', 'minutes-pdfs', false);

-- Storage policies for minutes PDFs
CREATE POLICY "Admins and leaders can view PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'minutes-pdfs' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'leader')
    )
  );

CREATE POLICY "Admins can upload PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'minutes-pdfs' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update PDFs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'minutes-pdfs' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete PDFs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'minutes-pdfs' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );