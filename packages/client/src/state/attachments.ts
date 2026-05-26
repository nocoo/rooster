import { signal, computed } from '@preact/signals'
import { uploadFile, type UploadResult } from '../api/upload.js'

export interface PendingAttachment {
  localId: string
  original_name: string
  mime_type: string
  size: number
  status: 'uploading' | 'ready' | 'error'
  serverId?: string
  error?: string
}

export const pendingAttachments = signal<PendingAttachment[]>([])

export const readyAttachments = computed(() =>
  pendingAttachments.value.filter((a) => a.status === 'ready'),
)

export const hasUploading = computed(() =>
  pendingAttachments.value.some((a) => a.status === 'uploading'),
)

let nextLocalId = 0

export function addFiles(files: FileList, sessionId?: string): void {
  for (const file of Array.from(files)) {
    const localId = `local-${String(++nextLocalId)}`
    const entry: PendingAttachment = {
      localId,
      original_name: file.name,
      mime_type: file.type,
      size: file.size,
      status: 'uploading',
    }
    pendingAttachments.value = [...pendingAttachments.value, entry]
    void doUpload(localId, file, sessionId)
  }
}

async function doUpload(localId: string, file: File, sessionId?: string): Promise<void> {
  try {
    const result: UploadResult = await uploadFile(file, sessionId)
    updateEntry(localId, { status: 'ready', serverId: result.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    updateEntry(localId, { status: 'error', error: message })
  }
}

function updateEntry(localId: string, patch: Partial<PendingAttachment>): void {
  pendingAttachments.value = pendingAttachments.value.map((a) =>
    a.localId === localId ? { ...a, ...patch } : a,
  )
}

export function removeAttachment(localId: string): void {
  pendingAttachments.value = pendingAttachments.value.filter((a) => a.localId !== localId)
}

export function clearAttachments(): void {
  pendingAttachments.value = pendingAttachments.value.filter((a) => a.status === 'error')
}
