// A small PDF writer for the property report. It uses the PDF standard fonts
// (Helvetica, Helvetica-Bold, Helvetica-Oblique, Courier, Courier-Bold), so no
// font files are bundled. Supports flowing wrapped text plus absolutely
// positioned text, rectangles (optionally rounded), lines and polygons, page
// breaks and a per-page footer. Coordinates are PDF points from the bottom left.

export type Rgb = [number, number, number];
export type Font = "regular" | "bold" | "italic" | "mono" | "monoBold";

const FONT_RESOURCE: Record<Font, string> = { regular: "F1", bold: "F2", italic: "F3", mono: "F4", monoBold: "F5" };

export type DrawTextOptions = {
  size?: number;
  font?: Font;
  color?: Rgb;
  /** Extra space between characters, in points (for tracked capitals). */
  charSpacing?: number;
};

export type RectOptions = {
  fill?: Rgb;
  stroke?: Rgb;
  lineWidth?: number;
  radius?: number;
};

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

/** Width of `text` in any of the document fonts, including character spacing. */
export function measure(text: string, size: number, font: Font = "regular", charSpacing = 0): number {
  const chars = [...text].length;
  const base = font === "mono" || font === "monoBold"
    ? (chars * 600 * size) / 1000 // Courier is fixed-width
    : textWidth(text, size, font === "bold"); // Oblique shares Helvetica's metrics
  return base + charSpacing * Math.max(0, chars - 1);
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
  readonly margin = 44;
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

  /** The flowing-text cursor (top of the next line), in points from the bottom. */
  get cursor(): number {
    return this.y;
  }

  set cursor(value: number) {
    this.y = value;
  }

  /** Lowest y content may reach before the footer. */
  get bottom(): number {
    return this.margin + this.footerHeight;
  }

  /** Top of the content area on every page. */
  get top(): number {
    return this.height - this.margin;
  }

  /** Split text into lines that fit `width`. */
  wrap(text: string, size: number, bold: boolean | Font, width: number): string[] {
    const font: Font = typeof bold === "string" ? bold : bold ? "bold" : "regular";
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (measure(candidate, size, font) <= width || !line) {
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
        `BT /${bold ? "F2" : "F1"} ${size} Tf 0 Tc ${num(r)} ${num(g)} ${num(b)} rg ${num(this.margin + indent)} ${num(this.y)} Td ${pdfString(line)} Tj ET`,
      );
      this.y -= leading - size;
    }
  }

  /** Draw one line of text with its baseline at `y`. */
  drawText(x: number, y: number, text: string, opts: DrawTextOptions = {}): void {
    const size = opts.size ?? 10;
    const [r, g, b] = opts.color ?? [0.1, 0.1, 0.1];
    // Tc is part of the page's text state and persists, so always set it.
    const tc = `${num(opts.charSpacing ?? 0)} Tc `;
    this.ops.push(
      `BT /${FONT_RESOURCE[opts.font ?? "regular"]} ${size} Tf ${tc}${num(r)} ${num(g)} ${num(b)} rg ${num(x)} ${num(y)} Td ${pdfString(text)} Tj ET`,
    );
  }

  /** A rectangle with its bottom-left corner at (x, y). */
  rect(x: number, y: number, w: number, h: number, opts: RectOptions = {}): void {
    const { fill, stroke } = opts;
    if (!fill && !stroke) return;
    const r = Math.min(opts.radius ?? 0, w / 2, h / 2);
    let path: string;
    if (r <= 0) {
      path = `${num(x)} ${num(y)} ${num(w)} ${num(h)} re`;
    } else {
      const k = r * 0.5523; // Bezier control offset for a quarter circle
      const x2 = x + w;
      const y2 = y + h;
      path = [
        `${num(x + r)} ${num(y)} m`,
        `${num(x2 - r)} ${num(y)} l`,
        `${num(x2 - r + k)} ${num(y)} ${num(x2)} ${num(y + r - k)} ${num(x2)} ${num(y + r)} c`,
        `${num(x2)} ${num(y2 - r)} l`,
        `${num(x2)} ${num(y2 - r + k)} ${num(x2 - r + k)} ${num(y2)} ${num(x2 - r)} ${num(y2)} c`,
        `${num(x + r)} ${num(y2)} l`,
        `${num(x + r - k)} ${num(y2)} ${num(x)} ${num(y2 - r + k)} ${num(x)} ${num(y2 - r)} c`,
        `${num(x)} ${num(y + r)} l`,
        `${num(x)} ${num(y + r - k)} ${num(x + r - k)} ${num(y)} ${num(x + r)} ${num(y)} c`,
        "h",
      ].join(" ");
    }
    const colors = [
      fill ? `${num(fill[0])} ${num(fill[1])} ${num(fill[2])} rg` : "",
      stroke ? `${num(stroke[0])} ${num(stroke[1])} ${num(stroke[2])} RG ${num(opts.lineWidth ?? 0.75)} w` : "",
    ].filter(Boolean).join(" ");
    this.ops.push(`q ${colors} ${path} ${fill && stroke ? "B" : fill ? "f" : "S"} Q`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Rgb = [0.8, 0.8, 0.8], width = 0.75): void {
    this.ops.push(`q ${num(color[0])} ${num(color[1])} ${num(color[2])} RG ${num(width)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S Q`);
  }

  /** A filled polygon through `points`. */
  polygon(points: [number, number][], fill: Rgb): void {
    if (points.length < 3) return;
    const [first, ...rest] = points;
    const path = [`${num(first![0])} ${num(first![1])} m`, ...rest.map(([px, py]) => `${num(px)} ${num(py)} l`), "h"].join(" ");
    this.ops.push(`q ${num(fill[0])} ${num(fill[1])} ${num(fill[2])} rg ${path} f Q`);
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

    // 1 catalog, 2 page tree, 3–7 fonts, 8 info, then a page + content pair per page.
    const firstPage = 9;
    const kids = this.pages.map((_, i) => `${firstPage + i * 2} 0 R`).join(" ");
    add("<< /Type /Catalog /Pages 2 0 R >>");
    add(`<< /Type /Pages /Kids [${kids}] /Count ${total} >>`);
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>");
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>");
    add(`<< /Title ${pdfString(this.title)} /Producer (Casa Dossier) >>`);

    this.pages.forEach((pageOps, i) => {
      const ops = [...pageOps];
      if (footer) {
        ops.push(`BT /F1 8 Tf 0 Tc 0.45 0.45 0.45 rg ${this.margin} ${this.margin - 12} Td ${pdfString(footer(i + 1, total))} Tj ET`);
      }
      const stream = ops.join("\n");
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R /F5 7 0 R >> >> /Contents ${firstPage + i * 2 + 1} 0 R >>`);
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
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, "latin1");
  }
}
