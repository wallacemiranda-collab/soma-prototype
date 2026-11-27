import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { parseLibreViewAgpPage, LIBREVIEW_PDF_MAX_BYTES } from './libreviewAgpPdfCore.js'

export { LIBREVIEW_PDF_MAX_BYTES }

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export const LIBREVIEW_PDF_MAX_PAGES = 30

export async function parseLibreViewAgpPdf(file) {
  if (!file || file.type !== 'application/pdf' || file.size < 100 || file.size > LIBREVIEW_PDF_MAX_BYTES) {
    throw new Error('Selecione um PDF de até 10 MB.')
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const task = pdfjsLib.getDocument({
    data: bytes,
    isEvalSupported: false,
    enableXfa: false,
    maxImageSize: 0,
  })
  try {
    const document = await task.promise
    if (document.numPages < 1 || document.numPages > LIBREVIEW_PDF_MAX_PAGES) {
      return { status: 'unrecognized', metrics: null, parserVersion: 'libreview-agp-text-v1' }
    }
    const page = await document.getPage(1)
    const content = await page.getTextContent()
    return parseLibreViewAgpPage(content.items, page.view)
  } catch {
    throw new Error('Não foi possível ler este PDF. Confira se o arquivo abre no celular e tente novamente.')
  } finally {
    await task.destroy()
  }
}

