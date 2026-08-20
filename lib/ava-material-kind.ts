import type { AvaMaterial } from '@/lib/ava-types'

export type AvaMaterialKind =
  | 'archive'
  | 'audio'
  | 'book'
  | 'document'
  | 'file'
  | 'folder'
  | 'image'
  | 'link'
  | 'page'
  | 'pdf'
  | 'presentation'
  | 'spreadsheet'
  | 'video'

type MaterialIdentity = Pick<AvaMaterial, 'fileName' | 'mimeType' | 'type'>

function hasExtension(fileName: string, extensions: string[]): boolean {
  return extensions.some((extension) => fileName.endsWith(`.${extension}`))
}

export function getAvaMaterialKind(material: MaterialIdentity): AvaMaterialKind {
  const type = material.type.toLowerCase()
  const mimeType = material.mimeType?.toLowerCase() || ''
  const fileName = material.fileName?.toLowerCase() || ''

  if (type === 'url') return 'link'
  if (type === 'folder') return 'folder'
  if (type === 'book') return 'book'
  if (type === 'page' || type === 'glossary' || type === 'database') return 'page'

  if (mimeType === 'application/pdf' || hasExtension(fileName, ['pdf'])) return 'pdf'
  if (
    mimeType.includes('spreadsheet')
    || mimeType.includes('excel')
    || mimeType === 'text/csv'
    || hasExtension(fileName, ['csv', 'ods', 'xls', 'xlsx'])
  ) return 'spreadsheet'
  if (
    mimeType.includes('presentation')
    || mimeType.includes('powerpoint')
    || hasExtension(fileName, ['odp', 'ppt', 'pptx'])
  ) return 'presentation'
  if (mimeType.startsWith('image/') || hasExtension(fileName, ['gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'])) return 'image'
  if (mimeType.startsWith('video/') || hasExtension(fileName, ['avi', 'mkv', 'mov', 'mp4', 'webm'])) return 'video'
  if (mimeType.startsWith('audio/') || hasExtension(fileName, ['aac', 'm4a', 'mp3', 'ogg', 'wav'])) return 'audio'
  if (
    mimeType.includes('zip')
    || mimeType.includes('compressed')
    || hasExtension(fileName, ['7z', 'gz', 'rar', 'tar', 'zip'])
  ) return 'archive'
  if (
    mimeType.startsWith('text/')
    || mimeType.includes('document')
    || mimeType.includes('word')
    || hasExtension(fileName, ['doc', 'docx', 'odt', 'rtf', 'txt'])
  ) return 'document'

  return 'file'
}
