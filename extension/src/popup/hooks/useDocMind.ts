import { useState, useEffect } from 'react';
import { browser, getActiveTab } from '../../shared/browser';
import type { ExtractionResult, ErrorCode, Action, Citation } from '../../shared/types';
import { fetchAnswer } from '../api';

type BaseExtracted = {
  text: string;
  charCount: number;
  truncated: boolean;
  isPDF: boolean;
  url: string;
};

export type State =
  | { status: 'idle' }
  | { status: 'extracting' }
  | ({ status: 'extracted' } & BaseExtracted)
  | ({ status: 'querying'; action: Action } & BaseExtracted)
  | ({ status: 'success'; answer: string; citations: Citation[]; action: Action } & BaseExtracted)
  | ({
      status: 'error';
      error: ErrorCode;
      lastAction?: Action;
      lastQuestion?: string;
    } & Partial<BaseExtracted>);

type PendingContext = {
  kind: 'selection';
  tabId: number;
  selectionText: string;
  createdAt: number;
} | null;

type PendingContextResponse = {
  type: 'PENDING_CONTEXT';
  payload: PendingContext;
};

export function useDocMind() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [prefillQuestion, setPrefillQuestion] = useState<string | null>(null);

  // Auto-extract on mount
  useEffect(() => {
    extract();
  }, []);

  // Check for pending context from context menu
  useEffect(() => {
    async function checkPendingContext() {
      try {
        const response = await browser.runtime.sendMessage({
          type: 'GET_PENDING_CONTEXT',
        }) as PendingContextResponse;

        if (response?.payload?.selectionText) {
          const question = `What does this mean: "${response.payload.selectionText}"?`;
          setPrefillQuestion(question);

          // Fire and forget - clear the pending context
          browser.runtime.sendMessage({ type: 'CLEAR_PENDING_CONTEXT' });
        }
      } catch {
        // Silently fail - context menu flow is optional
      }
    }

    checkPendingContext();
  }, []);

  async function extract() {
    setState({ status: 'extracting' });

    try {
      const tab = await getActiveTab();

      if (!tab?.id) {
        setState({ status: 'error', error: 'CANNOT_ACCESS_PAGE' });
        return;
      }

      const result = (await browser.runtime.sendMessage({
        type: 'EXTRACT_TEXT',
        tabId: tab.id,
      })) as ExtractionResult;

      if (!result.success) {
        setState({
          status: 'error',
          error: result.error || 'EXTRACTION_FAILED',
        });
        return;
      }

      setState({
        status: 'extracted',
        text: result.text,
        charCount: result.charCount,
        truncated: result.truncated,
        isPDF: result.isPDF,
        url: tab.url || '',
      });
    } catch {
      setState({ status: 'error', error: 'EXTRACTION_FAILED' });
    }
  }

  async function runAction(action: Action, question?: string) {
    if (state.status !== 'extracted' && state.status !== 'success') return;

    const { text, charCount, truncated, isPDF, url } = state;
    setState({ status: 'querying', text, charCount, truncated, isPDF, url, action });

    const result = await fetchAnswer(text, charCount, action, question, url);

    if ('error' in result) {
      setState({
        status: 'error',
        error: result.error,
        text,
        charCount,
        truncated,
        isPDF,
        url,
        lastAction: action,
        lastQuestion: question,
      });
      return;
    }

    setState({
      status: 'success',
      answer: result.answer,
      citations: result.citations,
      action,
      text,
      charCount,
      truncated,
      isPDF,
      url,
    });
  }

  function retry() {
    if (state.status === 'error' && state.lastAction && state.text) {
      runAction(state.lastAction, state.lastQuestion);
      return;
    }

    if ('text' in state && state.text) {
      setState({
        status: 'extracted',
        text: state.text,
        charCount: state.charCount!,
        truncated: state.truncated!,
        isPDF: state.isPDF!,
        url: state.url || '',
      });
    } else {
      extract();
    }
  }

  function clearPrefill() {
    setPrefillQuestion(null);
  }

  return { state, extract, runAction, retry, prefillQuestion, clearPrefill };
}
