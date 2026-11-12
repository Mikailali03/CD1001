// A small PDF writer for text documents (the property report). It uses the
// built-in Helvetica fonts, so no font files are bundled. Supports wrapped text,
// colour, horizontal rules, page breaks and a per-page footer.

type Rgb = [number, number, number];

export type TextOptions = {
  size?: number;
  bold?: boolean;
  color?: Rgb;
  indent?: number;
  lineGap?: number;
};

// Advance widths (1/1000 em) for ASCII 32–126, from the standard Helvetica AFMs.
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

// Unicode → WinAnsiEncoding for characters outside Latin-1.
const WIN_ANSI_EXTRAS: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2122: 0x99,
};

function winAnsiCode(ch: string): number {
  const cp = ch.codePointAt(0)!;
  if (cp < 0x80 || (cp >= 0xa0 && cp <= 0xff)) return cp;
  return WIN_ANSI_EXTRAS[cp] ?? 0x3f; // "?"
}

function charWidth(code: number, bold: boolean): number {
  const table = bold ? HELVETICA_BOLD : HELVETICA;
  return code >= 32 && code <= 126 ? table[code - 32]! : 556;
}

export function textWidth(text: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of text) w += charWidth(winAnsiCode(ch), bold);
  return (w * size) / 1000;
}

/** A PDF string literal; non-ASCII bytes are written as octal escapes. */
function pdfString(text: string): string {
  let out = "(";
  for (const ch of text) {
    const code = winAnsiCode(ch);
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += `\\${String.fromCharCode(code)}`;
    else if (code < 0x20 || code > 0x7e) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(code);
  }
  return `${out})`;
}

const num = (n: number) => (Math.round(n * 100) / 100).toString();

export class PdfDocument {
  readonly width = 612; // US Letter
  readonly height = 792;
  readonly margin = 54;
  private readonly footerHeight = 36;
  private pages: string[][] = [];
  private y = 0;

  constructor(private readonly title: string) {
    this.addPage();
  }

  get contentWidth(): number {
    return this.width - this.margin * 2;
  }

  private get ops(): string[] {
    return this.pages[this.pages.length - 1]!;
  }

  addPage(): void {
    this.pages.push([]);
    this.y = this.height - this.margin;
  }

  /** Start a new page unless `height` points still fit above the footer. */
  ensureSpace(height: number): void {
    if (this.y - height < this.margin + this.footerHeight) this.addPage();
  }

  moveDown(points: number): void {
    this.y -= points;
  }

  /** Split text into lines that fit `width`. */
  wrap(text: string, size: number, bold: boolean, width: number): string[] {
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (textWidth(candidate, size, bold) <= width || !line) {
          line = candidate;
        } else {
          lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  text(text: string, opts: TextOptions = {}): void {
    const size = opts.size ?? 10;
    const bold = opts.bold ?? false;
    const indent = opts.indent ?? 0;
    const leading = size * 1.3 + (opts.lineGap ?? 0);
    const [r, g, b] = opts.color ?? [0.1, 0.1, 0.1];
    for (const line of this.wrap(text, size, bold, this.contentWidth - indent)) {
      this.ensureSpace(leading);
      this.y -= size;
      this.ops.push(
        `BT /${bold ? "F2" : "F1"} ${size} Tf ${num(r)} ${num(g)} ${num(b)} rg ${num(this.margin + indent)} ${num(this.y)} Td ${pdfString(line)} Tj ET`,
      );
      this.y -= leading - size;
    }
  }

  rule(color: Rgb = [0.8, 0.8, 0.8], thickness = 0.75): void {
    this.ensureSpace(8);
    this.y -= 4;
    const [r, g, b] = color;
    this.ops.push(`${num(r)} ${num(g)} ${num(b)} RG ${thickness} w ${this.margin} ${num(this.y)} m ${this.width - this.margin} ${num(this.y)} l S`);
    this.y -= 4;
  }

  /** Render to bytes; `footer` is drawn on every page with its number. */
  toBuffer(footer?: (page: number, total: number) => string): Buffer {
    const total = this.pages.length;
    const objects: string[] = [];
    const add = (body: string) => objects.push(body) ;

    // 1 catalog, 2 page tree, 3–4 fonts, 5 info, then a page + content pair per page.
    const firstPage = 6;
    const kids = this.pages.map((_, i) => `${firstPage + i * 2} 0 R`).join(" ");
    add("<< /Type /Catalog /Pages 2 0 R >>");
    add(`<< /Type /Pages /Kids [${kids}] /Count ${total} >>`);
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    add(`<< /Title ${pdfString(this.title)} /Producer (Casa Dossier) >>`);

    this.pages.forEach((pageOps, i) => {
      const ops = [...pageOps];
      if (footer) {
        ops.push(`BT /F1 8 Tf 0.45 0.45 0.45 rg ${this.margin} ${this.margin - 12} Td ${pdfString(footer(i + 1, total))} Tj ET`);
      }
      const stream = ops.join("\n");
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${firstPage + i * 2 + 1} 0 R >>`);
      add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    });

    let out = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(Buffer.byteLength(out, "latin1"));
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = Buffer.byteLength(out, "latin1");
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    out += offsets.map((o) => `${o.toString().padStart(10, "0")} 00000 n \n`).join("");
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, "latin1");
  }
}
