import { supabase } from './supabaseClient';

const cleanName = (name) => (name || 'audio').replace(/[^a-zA-Z0-9._-]/g, '_');

export async function createHumanOrder({ clientId, file, durationMinutes, serviceType, rush, difficulty, speakerCount, timestamps, formattingNotes, quote }) {
  if (!supabase) throw new Error('Preview database is not configured.');
  let assetId = null;
  if (file) {
    const path = `${clientId}/${crypto.randomUUID()}/${cleanName(file.name)}`;
    const upload = await supabase.storage.from('human-audio').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (upload.error) throw upload.error;
    const asset = await supabase.from('audio_assets').insert({ owner_id: clientId, storage_path: path, original_filename: file.name, mime_type: file.type || null, size_bytes: file.size, duration_seconds: Math.round(durationMinutes * 60) }).select('id').single();
    if (asset.error) throw asset.error;
    assetId = asset.data.id;
  }
  const inserted = await supabase.from('orders').insert({
    client_id: clientId,
    audio_asset_id: assetId,
    status: 'draft',
    service_type: serviceType,
    turnaround: rush ? 'rush' : 'standard',
    difficulty,
    speaker_count: Number(speakerCount),
    timestamps_requested: timestamps,
    formatting_notes: formattingNotes,
    quote_currency: quote.currency,
    quote_amount: quote.amount,
  }).select('*').single();
  if (inserted.error) throw inserted.error;
  const submitted = await supabase.rpc('submit_client_order', { p_order_id: inserted.data.id });
  if (submitted.error) throw submitted.error;
  return submitted.data || inserted.data;
}

export async function listClientOrders(clientId) {
  if (!supabase) return { data: [], error: null };
  return supabase.from('orders').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
}

export async function listOpenJobs() {
  if (!supabase) return { data: [], error: null };
  return supabase.from('orders').select('*').eq('status', 'approved_open').order('created_at', { ascending: true });
}

export async function claimHumanJob(orderId) {
  if (!supabase) throw new Error('Preview database is not configured.');
  const result = await supabase.rpc('claim_open_job', { p_order_id: orderId });
  if (result.error) throw result.error;
  return result.data;
}

export async function submitHumanTranscript(orderId, editorSnapshot, workerNotes = '') {
  if (!supabase) throw new Error('Preview database is not configured.');
  const result = await supabase.rpc('submit_worker_transcript', { p_order_id: orderId, p_editor_snapshot: editorSnapshot || {}, p_worker_notes: workerNotes });
  if (result.error) throw result.error;
  return result.data;
}

export async function listAdminQueue() {
  if (!supabase) return { data: [], error: null };
  return supabase.from('orders').select('*').in('status', ['pending_admin_review', 'submitted']).order('created_at', { ascending: true });
}

export async function approveHumanOrder(orderId) {
  if (!supabase) throw new Error('Preview database is not configured.');
  const result = await supabase.rpc('approve_order_for_workers', { p_order_id: orderId });
  if (result.error) throw result.error;
  return result.data;
}

export async function listSubmittedTranscripts() {
  if (!supabase) return { data: [], error: null };
  return supabase.from('transcript_submissions').select('*').eq('status', 'submitted').order('submitted_at', { ascending: true });
}

export async function approveHumanSubmission(submissionId, reviewNotes = '') {
  if (!supabase) throw new Error('Preview database is not configured.');
  const result = await supabase.rpc('approve_transcript_delivery', { p_submission_id: submissionId, p_review_notes: reviewNotes });
  if (result.error) throw result.error;
  return result.data;
}
