import { describe, expect, it } from 'vitest'

import { getAvaMaterialKind } from '@/lib/ava-material-kind'

describe('AVA material icons', () => {
  it.each([
    [{ type: 'resource', mimeType: 'application/pdf', fileName: 'aula.pdf' }, 'pdf'],
    [{ type: 'resource', fileName: 'notas.docx' }, 'document'],
    [{ type: 'resource', fileName: 'dados.xlsx' }, 'spreadsheet'],
    [{ type: 'resource', fileName: 'seminario.pptx' }, 'presentation'],
    [{ type: 'resource', mimeType: 'image/jpeg', fileName: 'foto.jpg' }, 'image'],
    [{ type: 'resource', mimeType: 'video/mp4', fileName: 'aula.mp4' }, 'video'],
    [{ type: 'resource', mimeType: 'audio/mpeg', fileName: 'audio.mp3' }, 'audio'],
    [{ type: 'resource', fileName: 'materiais.zip' }, 'archive'],
    [{ type: 'url' }, 'link'],
    [{ type: 'folder' }, 'folder'],
    [{ type: 'book' }, 'book'],
  ] as const)('maps %o to %s', (material, expected) => {
    expect(getAvaMaterialKind(material)).toBe(expected)
  })
})
