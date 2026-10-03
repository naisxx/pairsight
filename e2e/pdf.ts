import { readFileSync } from 'node:fs'
import { PDFParse } from 'pdf-parse'

// A downloaded PDF's text, with every run of whitespace (line wraps, page
// breaks) as one space, so a spec can look for a sentence wherever it wrapped.
export async function readPdfText(path: string): Promise<string> {
	const parser = new PDFParse({ data: readFileSync(path) })
	try {
		const { text } = await parser.getText()
		return text.replace(/\s+/g, ' ')
	} finally {
		await parser.destroy()
	}
}
