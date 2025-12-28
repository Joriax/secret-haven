-- Fix RLS policies for shared_album_items to be PERMISSIVE
-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can manage shared album items" ON public.shared_album_items;

-- Create permissive policies for shared_album_items
CREATE POLICY "Allow insert shared album items"
ON public.shared_album_items
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow select shared album items"
ON public.shared_album_items
FOR SELECT
USING (true);

CREATE POLICY "Allow update shared album items"
ON public.shared_album_items
FOR UPDATE
USING (true);

CREATE POLICY "Allow delete shared album items"
ON public.shared_album_items
FOR DELETE
USING (true);

-- Fix RLS policies for shared_albums to be PERMISSIVE
DROP POLICY IF EXISTS "Owners can do everything with their shared albums" ON public.shared_albums;

CREATE POLICY "Allow all on shared_albums"
ON public.shared_albums
FOR ALL
USING (true)
WITH CHECK (true);

-- Fix RLS policies for shared_album_access to be PERMISSIVE
DROP POLICY IF EXISTS "Users can manage shared album access" ON public.shared_album_access;

CREATE POLICY "Allow all on shared_album_access"
ON public.shared_album_access
FOR ALL
USING (true)
WITH CHECK (true);