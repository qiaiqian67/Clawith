import { useMemo } from 'react';

import { parseMarkdown, type InlineMark } from '../../shared/markdown.ts';
import './markdown-view.css';

/**
 * The Markdown of an assistant message.
 *
 * The blocks are drawn, never interpreted as markup, so a message cannot
 * inject anything into the page.
 */

export interface MarkdownViewProps {
  /** The Markdown text of the message. */
  content: string;
}

export function MarkdownView(props: MarkdownViewProps) {
  const blocks = useMemo(() => parseMarkdown(props.content), [props.content]);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="zx-markdown">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}

function BlockView(props: { block: ReturnType<typeof parseMarkdown>[number] }) {
  const { block } = props;
  if (block.kind === 'paragraph') {
    return <p className="zx-md-paragraph">{renderInlines(block.inlines)}</p>;
  }
  if (block.kind === 'heading') {
    const Tag = `h${Math.min(block.level + 1, 6)}` as 'h2';
    return <Tag className="zx-md-heading">{renderInlines(block.inlines)}</Tag>;
  }
  if (block.kind === 'code') {
    return (
      <pre className="zx-md-code" data-language={block.language || undefined}>
        <code>{block.text}</code>
      </pre>
    );
  }
  if (block.kind === 'list') {
    const Tag = block.ordered ? 'ol' : 'ul';
    return (
      <Tag className="zx-md-list">
        {block.items.map((item, index) => (
          <li key={index}>{renderInlines(item)}</li>
        ))}
      </Tag>
    );
  }
  if (block.kind === 'quote') {
    return <blockquote className="zx-md-quote">{renderInlines(block.inlines)}</blockquote>;
  }
  if (block.kind === 'rule') {
    return <hr className="zx-md-rule" />;
  }
  return (
    <div className="zx-md-table-wrap">
      <table className="zx-md-table">
        <thead>
          <tr>
            {block.header.map((cell, index) => (
              <th key={index}>{renderInlines(cell)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{renderInlines(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderInlines(marks: InlineMark[]) {
  return marks.map((mark, index) => {
    if (mark.kind === 'code') {
      return (
        <code key={index} className="zx-md-inline-code">
          {mark.text}
        </code>
      );
    }
    if (mark.kind === 'bold') {
      return <strong key={index}>{mark.text}</strong>;
    }
    if (mark.kind === 'italic') {
      return <em key={index}>{mark.text}</em>;
    }
    if (mark.kind === 'strike') {
      return <s key={index}>{mark.text}</s>;
    }
    if (mark.kind === 'link') {
      const safe = isSafeHref(mark.href);
      return (
        <a
          key={index}
          href={safe ? mark.href : undefined}
          className="zx-md-link"
          target="_blank"
          rel="noreferrer noopener"
        >
          {mark.text}
        </a>
      );
    }
    return <span key={index}>{mark.text}</span>;
  });
}

/** Whether a link may be opened. Only the web schemes are allowed. */
function isSafeHref(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href.trim());
}
