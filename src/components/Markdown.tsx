import React from 'react';

/** Render simple inline markdown: **bold** and [text](url) links. */
const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  // Split on links first
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  const pushText = (chunk: string) => {
    // handle **bold**
    const parts = chunk.split(/(\*\*[^*]+\*\*)/g);
    parts.forEach((p) => {
      if (!p) return;
      if (p.startsWith('**') && p.endsWith('**')) {
        nodes.push(<strong key={`${keyPrefix}-b-${i++}`} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>);
      } else {
        nodes.push(<React.Fragment key={`${keyPrefix}-t-${i++}`}>{p}</React.Fragment>);
      }
    });
  };
  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) pushText(text.slice(lastIndex, match.index));
    const href = match[2];
    nodes.push(
      <a key={`${keyPrefix}-l-${i++}`} href={href} className="text-primary underline underline-offset-2 break-all" target={href.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer">
        {match[1]}
      </a>
    );
    lastIndex = linkRegex.lastIndex;
  }
  if (lastIndex < text.length) pushText(text.slice(lastIndex));
  return nodes;
};

const Markdown = ({ content }: { content: string }) => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, idx) => (
      <li key={`li-${key}-${idx}`} className="text-sm text-muted-foreground leading-relaxed">
        {renderInline(it, `li-${key}-${idx}`)}
      </li>
    ));
    blocks.push(
      list.type === 'ul' ? (
        <ul key={`ul-${key++}`} className="list-disc pl-5 space-y-1.5 my-2">{items}</ul>
      ) : (
        <ol key={`ol-${key++}`} className="list-decimal pl-5 space-y-1.5 my-2">{items}</ol>
      )
    );
    list = null;
  };

  lines.forEach((raw) => {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed === '') { flushList(); return; }
    if (trimmed === '---') {
      flushList();
      blocks.push(<hr key={`hr-${key++}`} className="my-5 border-border" />);
      return;
    }
    // headings
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      const txt = h[2];
      const cls =
        level === 1 ? 'text-xl font-black text-foreground mt-5 mb-2 first:mt-0'
        : level === 2 ? 'text-lg font-bold text-foreground mt-5 mb-2'
        : level === 3 ? 'text-sm font-bold text-foreground mt-4 mb-1.5'
        : 'text-sm font-semibold text-foreground mt-3 mb-1';
      blocks.push(<p key={`h-${key++}`} className={cls}>{renderInline(txt, `h-${key}`)}</p>);
      return;
    }
    // bullet list (• or - or *)
    const bullet = trimmed.match(/^([•\-*])\s+(.*)$/);
    if (bullet) {
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
      list.items.push(bullet[2]);
      return;
    }
    // numbered list
    const num = trimmed.match(/^\d+\.\s+(.*)$/);
    if (num) {
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
      list.items.push(num[1]);
      return;
    }
    // paragraph
    flushList();
    blocks.push(
      <p key={`p-${key++}`} className="text-sm text-muted-foreground leading-relaxed my-2">
        {renderInline(trimmed, `p-${key}`)}
      </p>
    );
  });
  flushList();

  return <div className="space-y-0.5">{blocks}</div>;
};

export default Markdown;
