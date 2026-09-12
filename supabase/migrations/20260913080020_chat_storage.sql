-- Domain: chat — 0003 Attachments storage
-- Objects are stored as "{room_id}/{filename}"; access is gated by the same
-- app.chat_has_access() check used everywhere else in this domain, applied
-- to the room_id parsed from the object path.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760, -- 10 MB, see docs/specs/002-chat-domain.md §5
  array[
    'image/jpeg', 'image/png', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'text/plain'
  ]
)
on conflict (id) do nothing;

create policy chat_attachments_read on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-attachments'
    and app.chat_has_access(((storage.foldername(name))[1])::uuid)
  );

create policy chat_attachments_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and app.chat_has_access(((storage.foldername(name))[1])::uuid)
  );
