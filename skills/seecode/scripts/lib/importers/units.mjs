// One source file can hold several diagrams: fenced blocks in Markdown,
// pages in draw.io, @startuml sections in PlantUML, several Mermaid
// diagrams in one .mmd, frames on an Excalidraw board. splitUnits() lists
// them in source order, each with the format to parse it as and the best
// title the file offers for it (used to name its spec when importing --all).

const FENCE = /```\s*(mermaid|dot|graphviz|plantuml|puml|d2)\s*\n([\s\S]*?)```/g;
const FENCE_FORMAT = { mermaid: 'mermaid', dot: 'dot', graphviz: 'dot', plantuml: 'plantuml', puml: 'plantuml', d2: 'd2' };
export const MERMAID_HEAD = /^(flowchart|graph|sequenceDiagram|stateDiagram(-v2)?|erDiagram|classDiagram(-v2)?|gantt|pie|mindmap|journey|timeline|quadrantChart|sankey(-beta)?|xychart(-beta)?|gitGraph|block(-beta)?|architecture(-beta)?|C4\w+)\b/;

const strip = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/[*_`#]+/g, '').trim();

// The Markdown heading nearest above position `at`, if any.
function headingBefore(text, at) {
  let last = null;
  for (const m of text.slice(0, at).matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) last = m[1];
  return last ? strip(last) : undefined;
}

function markdownUnits(text) {
  return [...text.matchAll(FENCE)].map((m) => ({
    format: FENCE_FORMAT[m[1]],
    lang: m[1],
    source: m[2],
    title: headingBefore(text, m.index),
  }));
}

// draw.io: one unit per <diagram> page, named after the page tab.
function drawioUnits(xml) {
  const pages = [...xml.matchAll(/<diagram\b[^>]*>[\s\S]*?<\/diagram>/g)].map((m) => m[0]);
  if (pages.length < 2) return [{ format: 'drawio', source: xml }];
  return pages.map((page) => ({ format: 'drawio', source: page, title: strip(((page.match(/<diagram\b[^>]*\bname="([^"]*)"/) || [])[1] || '').replace(/&amp;/g, '&')) || undefined }));
}

// PlantUML: each @startxxx … @endxxx section, titled by its `title` line or
// the name after @startuml.
function plantumlUnits(text) {
  const parts = [...text.matchAll(/^\s*@start(\w+)([^\n]*)\n([\s\S]*?)^\s*@end\1\b.*$/gm)];
  if (parts.length < 2) return [{ format: 'plantuml', source: text }];
  return parts.map((m) => ({
    format: 'plantuml',
    source: m[0],
    title: strip((m[3].match(/^\s*title\s+(.+)$/m) || [])[1] || m[2].replace(/^\s*\(?id=/, '')) || undefined,
  }));
}

// Mermaid: a new diagram starts at an unindented header line (with its own
// `---` front matter just above it, if any).
function mermaidUnits(text) {
  const lines = text.split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (!MERMAID_HEAD.test(lines[i])) continue;
    let s = i;
    // pull a front-matter block (--- … ---) directly above into this diagram
    let j = i - 1;
    while (j >= 0 && !lines[j].trim()) j--;
    if (j >= 0 && lines[j].trim() === '---') {
      let k = j - 1;
      while (k >= 0 && lines[k].trim() !== '---') k--;
      if (k >= 0) s = k;
    }
    starts.push(s);
  }
  if (starts.length < 2) return [{ format: 'mermaid', source: text }];
  starts[0] = 0;
  return starts.map((s, k) => {
    const source = lines.slice(s, starts[k + 1] ?? lines.length).join('\n');
    const title = (source.match(/^\s*title:\s*(.+)$/m) || source.match(/^\s*title\s+(.+)$/m) || [])[1];
    return { format: 'mermaid', source, title: title ? strip(title) : undefined };
  });
}

// Excalidraw: each frame becomes a diagram with the shapes, texts and
// arrows inside it. Boards without frames stay one diagram.
function excalidrawUnits(text) {
  let doc;
  try { doc = JSON.parse(text); } catch { return [{ format: 'excalidraw', source: text }]; }
  const els = (doc.elements || []).filter((e) => e && !e.isDeleted);
  const frames = els.filter((e) => e.type === 'frame');
  if (frames.length < 2) return [{ format: 'excalidraw', source: text }];
  return frames
    .sort((a, b) => (a.y - b.y) || (a.x - b.x))
    .map((f) => {
      const inside = new Set(els.filter((e) => e.frameId === f.id).map((e) => e.id));
      // bound labels and arrows whose ends are both inside come along
      for (const e of els) if (e.containerId && inside.has(e.containerId)) inside.add(e.id);
      for (const e of els) if ((e.type === 'arrow' || e.type === 'line') && inside.has(e.startBinding?.elementId) && inside.has(e.endBinding?.elementId)) inside.add(e.id);
      for (const e of els) if (e.containerId && inside.has(e.containerId)) inside.add(e.id);
      const elements = els.filter((e) => inside.has(e.id)).map((e) => (e.frameId ? { ...e, frameId: null } : e));
      return { format: 'excalidraw', source: JSON.stringify({ type: 'excalidraw', elements }), title: f.name ? strip(f.name) : undefined };
    });
}

export function splitUnits(format, text) {
  switch (format) {
    case 'markdown': return markdownUnits(text);
    case 'drawio': return drawioUnits(text);
    case 'plantuml': return plantumlUnits(text);
    case 'mermaid': return mermaidUnits(text);
    case 'excalidraw': return excalidrawUnits(text);
    default: return [{ format, source: text }];
  }
}
