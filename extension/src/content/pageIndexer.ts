// extension/src/content/pageIndexer.ts
import { normalizeForMatching } from './normalizer';
import { parseUrlIdentity, type UrlIdentity } from '../shared/urlIdentity';
import { HIGHLIGHT_CONFIG } from '../shared/constants';

export interface TextSegment {
  text: string;
  normalizedText: string;
  type: 'prose' | 'code' | 'heading';
  nodePath: number[];
  textOffset: number;
}

export interface PageIdentity extends UrlIdentity {
  tabId: number;
  title: string;
  capturedAt: number;
}

export interface PageIndex {
  identity: PageIdentity;
  segments: TextSegment[];
  fullText: string;
  normalizedFullText: string;
  isStale: boolean;
  builtAt: number;
}

export class PageIndexer {
  private visibilityCache = new WeakMap<Element, boolean>();

  buildIndex(tabId: number): PageIndex | { error: 'too-large' | 'insufficient-text' } {
    const urlIdentity = parseUrlIdentity(window.location.href);
    const segments: TextSegment[] = [];
    const root = document.querySelector('main') || document.querySelector('article') || document.body;

    if (!root) {
      return { error: 'insufficient-text' };
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null
    );

    let nodeCount = 0;
    let node: Text | null;

    while ((node = walker.nextNode() as Text)) {
      if (++nodeCount > HIGHLIGHT_CONFIG.MAX_DOM_NODES) {
        return { error: 'too-large' };
      }

      if (!this.isVisible(node)) continue;

      const raw = node.textContent ?? '';
      const text = raw.trim();
      if (!text || text.length < 10) continue;
      if (text.length > HIGHLIGHT_CONFIG.MAX_NODE_TEXT_LEN) continue;

      const textOffset = raw.indexOf(text);

      const type = this.classifyNode(node);
      if (type !== 'prose') continue; // Phase 3a: prose only

      const segment: TextSegment = {
        text,
        normalizedText: normalizeForMatching(text, type),
        type,
        nodePath: this.getNodePath(node),
        textOffset: textOffset < 0 ? 0 : textOffset,
      };

      segments.push(segment);
    }

    if (segments.length === 0) {
      return { error: 'insufficient-text' };
    }

    const fullText = segments.map(s => s.text).join(' ');
    const normalizedFullText = segments.map(s => s.normalizedText).join(' ');

    return {
      identity: {
        ...urlIdentity,
        tabId,
        title: document.title,
        capturedAt: Date.now(),
      },
      segments,
      fullText,
      normalizedFullText,
      isStale: false,
      builtAt: Date.now(),
    };
  }

  private isVisible(node: Node): boolean {
    const element = node.nodeType === Node.ELEMENT_NODE
      ? node as Element
      : node.parentElement;

    if (!element) return false;

    if (this.visibilityCache.has(element)) {
      return this.visibilityCache.get(element)!;
    }

    const htmlElement = element as HTMLElement;

    if (htmlElement.offsetParent === null) {
      if (element.tagName !== 'BODY' && element.tagName !== 'HTML') {
        const position = getComputedStyle(element).position;
        if (position !== 'fixed' && position !== 'sticky') {
          this.visibilityCache.set(element, false);
          return false;
        }
      }
    }

    const style = getComputedStyle(element);
    const isInline = style.display === 'inline' || style.display === 'inline-block';

    if (!isInline && htmlElement.offsetWidth === 0 && htmlElement.offsetHeight === 0) {
      this.visibilityCache.set(element, false);
      return false;
    }

    const visible = style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    parseFloat(style.opacity) > 0;

    this.visibilityCache.set(element, visible);
    return visible;
  }

  private classifyNode(node: Text): 'prose' | 'code' | 'heading' {
    let parent = node.parentElement;
    while (parent) {
      const tag = parent.tagName.toLowerCase();
      if (tag === 'code' || tag === 'pre' || tag === 'samp' || tag === 'kbd') {
        return 'code';
      }
      if (/^h[1-6]$/.test(tag)) {
        return 'heading';
      }
      parent = parent.parentElement;
    }
    return 'prose';
  }

  private getNodePath(node: Node): number[] {
    const path: number[] = [];
    let current: Node | null = node;

    while (current && current !== document.body) {
      const parent: Node | null = current.parentNode;
      if (parent) {
        const children = Array.from(parent.childNodes);
        path.unshift(children.indexOf(current as ChildNode));
      }
      current = parent;
    }

    return path;
  }
}
