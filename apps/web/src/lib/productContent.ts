export type SpecGroup = { title?: string; rows: Array<[string, string]> };

export type ProductSection = {
  title: string;
  paragraphs: string[];
  items: string[];
  specs: SpecGroup[];
};

export type ProductContent = {
  summary: string[];
  sections: ProductSection[];
};

/**
 * Plain descriptions stay a single summary. Structured ones use:
 * "## Section", "### Spec group", "- bullet", "Label | Value" rows.
 */
export function parseProductDescription(raw: string): ProductContent {
  const summary: string[] = [];
  const sections: ProductSection[] = [];
  let current: ProductSection | null = null;

  for (const rawLine of (raw ?? '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('## ')) {
      current = { title: line.slice(3).trim(), paragraphs: [], items: [], specs: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      summary.push(line);
      continue;
    }
    if (line.startsWith('### ')) {
      current.specs.push({ title: line.slice(4).trim(), rows: [] });
      continue;
    }
    if (line.startsWith('- ')) {
      current.items.push(line.slice(2).trim());
      continue;
    }
    const pipe = line.indexOf(' | ');
    if (pipe > 0) {
      if (!current.specs.length) current.specs.push({ rows: [] });
      current.specs[current.specs.length - 1].rows.push([
        line.slice(0, pipe).trim(),
        line.slice(pipe + 3).trim(),
      ]);
      continue;
    }
    current.paragraphs.push(line);
  }

  return { summary, sections };
}

/** Short teaser for product cards. */
export function productSummary(raw: string): string {
  const { summary } = parseProductDescription(raw);
  return summary[0] ?? '';
}
