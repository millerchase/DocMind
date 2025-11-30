import { useState, useEffect } from 'react';
import { ExtractionResult, ErrorCode, Action } from '../../shared/types';
import { fetchAnswer } from '../api';

type BaseExtracted = {
  text: string;
  charCount: number;
  truncated: boolean;
  isPDF: boolean;
};

export type State =
  | { status: 'idle' }
  | { status: 'extracting' }
  | ({ status: 'extracted' } & BaseExtracted)
  | ({ status: 'querying'; action: Action } & BaseExtracted)
  | ({ status: 'success'; answer: string; action: Action } & BaseExtracted)
  | ({
      status: 'error';
      error: ErrorCode;
      lastAction?: Action;
      lastQuestion?: string;
    } & Partial<BaseExtracted>);

export function useDocMind() {
  const [state, setState] = useState<State>({ status: 'idle' });

  // Auto-extract on mount
  useEffect(() => {
    extract();
  }, []);

  async function extract() {
    setState({ status: 'extracting' });

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.id) {
        setState({ status: 'error', error: 'CANNOT_ACCESS_PAGE' });
        return;
      }

      const result = (await chrome.runtime.sendMessage({
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
      });
    } catch (err) {
      setState({ status: 'error', error: 'EXTRACTION_FAILED' });
    }
  }

  async function runAction(action: Action, question?: string) {
    if (state.status !== 'extracted' && state.status !== 'success') return;

    const { text, charCount, truncated, isPDF } = state;
    setState({ status: 'querying', text, charCount, truncated, isPDF, action });

    const result = await fetchAnswer(text, action, question);

    if ('error' in result) {
      setState({
        status: 'error',
        error: result.error,
        text,
        charCount,
        truncated,
        isPDF,
        lastAction: action,
        lastQuestion: question,
      });
      return;
    }

    setState({
      status: 'success',
      answer: result.answer,
      action,
      text,
      charCount,
      truncated,
      isPDF,
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
      });
    } else {
      extract();
    }
  }

  return { state, extract, runAction, retry };
}
