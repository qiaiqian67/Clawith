/**
 * The Markdown of an assistant message, as the blocks the interface draws.
 *
 * The parser is small on purpose. It handles the Markdown that an assistant
 * actually produces: paragraphs, headings, fenced and indented code, ordered
 * and unordered lists, block quotes, rules, tables, and the inline marks.
 *
 * Nothing is rendered as HTML. The blocks carry plain text, and the
 * interface draws them, so a message can never inject markup.
 */

export type InlineMark =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'strike'; text: string }
  | { kind: 'link'; text: string; href: string };

export type Block =
  | { kind: 'paragraph'; inlines: InlineMark[] }
  | { kind: 'heading'; level: number; inlines: InlineMark[] }
  | { kind: 'code'; language: string; text: string }
  | { kind: 'list'; ordered: boolean; items: InlineMark[][] }
  | { kind: 'quote'; inlines: InlineMark[] }
  | { kind: 'rule' }
  | { kind: 'table'; header: InlineMark[][]; rows: InlineMark[][][] };

/** The blocks of one Markdown text. */
export function parseMarkdown(source: string): Block[] {
  const lines = (source ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    // A fenced code block.
    const fence = /^\s*(`{3,}|~{3,})\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const length = fence[1].length;
      const language = fence[2] ?? '';
      const body: string[] = [];
      index += 1;
      while (index < lines.length) {
        const closing = new RegExp(`^\\s*${marker === '`' ? '`' : '~'}{${length},}\\s*$`);
        if (closing.test(lines[index])) {
          index += 1;
          break;
        }
        body.push(lines[index]);
        index += 1;
      }
      blocks.push({ kind: 'code', language, text: body.join('\n') });
      continue;
    }

    // A heading.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1].length,
        inlines: parseInline(heading[2]),
      });
      index += 1;
      continue;
    }

    // A horizontal rule.
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      blocks.push({ kind: 'rule' });
      index += 1;
      continue;
    }

    // A table: a header row, a separator row, and the body.
    if (line.includes('|') && index + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[index + 1])) {
      const header = splitRow(line);
      index += 2;
      const rows: InlineMark[][][] = [];
      while (index < lines.length && lines[index].includes('|') && lines[index].trim() !== '') {
        rows.push(splitRow(lines[index]).map(parseInline));
        index += 1;
      }
      blocks.push({
        kind: 'table',
        header: header.map(parseInline),
        rows,
      });
      continue;
    }

    // A list.
    const bullet = /^\s*([-*+])\s+(.*)$/.exec(line);
    const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const items: InlineMark[][] = [];
      while (index < lines.length) {
        const current = /^\s*([-*+])\s+(.*)$/.exec(lines[index]);
        const currentNumbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(lines[index]);
        if (ordered && !currentNumbered) break;
        if (!ordered && !current) break;
        items.push(parseInline((currentNumbered ?? current)![2]));
        index += 1;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }

    // A block quote.
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        body.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      blocks.push({ kind: 'quote', inlines: parseInline(body.join('\n')) });
      continue;
    }

    // A paragraph: the lines until a blank line or another block.
    const body: string[] = [];
    while (index < lines.length) {
      const current = lines[index];
      if (current.trim() === '') break;
      if (
        index > 0 &&
        (/^(#{1,6})\s+/.test(current) ||
          /^\s*(`{3,}|~{3,})/.test(current) ||
          /^\s*([-*+])\s+/.test(current) ||
          /^\s*\d+[.)]\s+/.test(current) ||
          /^\s*>/.test(current) ||
          /^\s*([-*_])\s*(\1\s*){2,}$/.test(current))
      ) {
        break;
      }
      body.push(current);
      index += 1;
    }
    blocks.push({ kind: 'paragraph', inlines: parseInline(body.join('\n')) });
  }

  return blocks;
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

/** The inline marks of one Markdown text. */
export function parseInline(source: string): InlineMark[] {
  const marks: InlineMark[] = [];
  let text = '';
  let index = 0;

  const flush = () => {
    if (text) {
      marks.push({ kind: 'text', text });
      text = '';
    }
  };

  while (index < source.length) {
    const rest = source.slice(index);

    // An inline code span.
    const code = /^`([^`]+)`/.exec(rest);
    if (code) {
      flush();
      marks.push({ kind: 'code', text: code[1] });
      index += code[0].length;
      continue;
    }

    // A link.
    const link = /^\[([^\]]*)\]\(([^)\s]+)\)/.exec(rest);
    if (link) {
      flush();
      marks.push({ kind: 'link', text: link[1] || link[2], href: link[2] });
      index += link[0].length;
      continue;
    }

    // A bold span.
    const bold = /^\*\*([^*]+)\*\*/.exec(rest);
    if (bold) {
      flush();
      marks.push({ kind: 'bold', text: bold[1] });
      index += bold[0].length;
      continue;
    }

    // A strike span.
    const strike = /^~~([^~]+)~~/.exec(rest);
    if (strike) {
      flush();
      marks.push({ kind: 'strike', text: strike[1] });
      index += strike[0].length;
      continue;
    }

    // An italic span.
    const italic = /^\*([^*]+)\*/.exec(rest);
    if (italic) {
      flush();
      marks.push({ kind: 'italic', text: italic[1] });
      index += italic[0].length;
      continue;
    }

    text += source[index];
    index += 1;
  }

  flush();
  return marks;
}

/** The plain text of a list of marks, without the marks. */
export function inlineText(marks: InlineMark[]): string {
  return marks.map((mark) => mark.text).join('');
}
