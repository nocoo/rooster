export interface UploadResult {
  id: string
  original_name: string
  mime_type: string
  size: number
}

export async function uploadFile(file: File, sessionId?: string): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  if (sessionId) form.append('session_id', sessionId)

  const res = await fetch('/api/upload', { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.json() as { error?: string }
    throw new Error(body.error ?? `Upload failed: ${String(res.status)}`)
  }
  return res.json() as Promise<UploadResult>
}
