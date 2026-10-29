import React, { useState, useCallback } from 'react';

/**
 * AIExplainerPanel
 *
 * Props:
 *   getCodeToExplain  – () => { code: string, isSelection: boolean }
 *   language          – { id: string, label: string }
 *   onClose           – () => void
 */
const AIExplainerPanel = ({ getCodeToExplain, language, onClose }) => {
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSelection, setIsSelection] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExplain = useCallback(async () => {
    const { code, isSelection: sel } = getCodeToExplain();

    if (!code || code.trim() === '') {
      setError('The editor is empty. Write or paste some code first.');
      return;
    }

    setIsLoading(true);
    setError('');
    setExplanation('');
    setIsSelection(sel);

    try {
      const apiBase =
        process.env.REACT_APP_BACKEND_URL || window.location.origin;
      const response = await fetch(
        new URL('/api/ai/explain', apiBase).toString(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            language: language?.id || 'plaintext',
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.message || `Request failed (${response.status}). Please try again.`);
        return;
      }

      // Strip LaTeX $ delimiters if the model emits them despite instructions.
      // $$...$$ first, then remaining single $...$ pairs.
      const raw = data.explanation || 'No explanation returned.';
      const sanitized = raw
        .replace(/\$\$([^$]+)\$\$/g, '$1')
        .replace(/\$([^$\n]+)\$/g, '$1');

      setExplanation(sanitized);
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? 'Could not reach the server. Make sure the backend is running.'
          : err.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [getCodeToExplain, language]);

  const handleCopy = useCallback(async () => {
    if (!explanation) return;
    try {
      await navigator.clipboard.writeText(explanation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = explanation;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [explanation]);

  /** Render markdown-ish text: bold **text**, inline `code`, fenced ```code``` */
  const renderExplanation = (text) => {
    if (!text) return null;

    const lines = text.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Fenced code block
      if (line.trim().startsWith('```')) {
        const lang = line.trim().slice(3).trim();
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        elements.push(
          <pre key={i} className="aiCodeBlock">
            {lang && <span className="aiCodeLang">{lang}</span>}
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        i++;
        continue;
      }

      // Heading lines (##, ###)
      const headingMatch = line.match(/^(#{1,4})\s+(.*)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const Tag = `h${Math.min(level + 2, 6)}`; // h3–h6
        elements.push(
          <Tag key={i} className={`aiHeading aiHeading${level}`}>
            {inlineFormat(headingMatch[2])}
          </Tag>
        );
        i++;
        continue;
      }

      // Bullet list item
      if (/^[-*]\s/.test(line.trim())) {
        const items = [];
        while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
          items.push(
            <li key={i} className="aiListItem">
              {inlineFormat(lines[i].trim().slice(2))}
            </li>
          );
          i++;
        }
        elements.push(<ul key={`ul-${i}`} className="aiList">{items}</ul>);
        continue;
      }

      // Numbered list item
      if (/^\d+\.\s/.test(line.trim())) {
        const items = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
          items.push(
            <li key={i} className="aiListItem">
              {inlineFormat(lines[i].trim().replace(/^\d+\.\s/, ''))}
            </li>
          );
          i++;
        }
        elements.push(<ol key={`ol-${i}`} className="aiList">{items}</ol>);
        continue;
      }

      // Empty line → spacer
      if (line.trim() === '') {
        elements.push(<div key={i} className="aiSpacer" />);
        i++;
        continue;
      }

      // Regular paragraph line
      elements.push(
        <p key={i} className="aiParagraph">
          {inlineFormat(line)}
        </p>
      );
      i++;
    }

    return elements;
  };

  /** Apply bold (**text**) and inline code (`text`) within a string */
  const inlineFormat = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={idx} className="aiInlineCode">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <div className="aiPanel">
      {/* Header */}
      <div className="aiPanelHeader">
        <span className="aiPanelTitle">✨ AI Code Explainer</span>
        <button
          className="aiPanelClose"
          onClick={onClose}
          title="Close panel"
          aria-label="Close AI Explainer panel"
        >
          ✕
        </button>
      </div>

      {/* Action bar */}
      <div className="aiActionBar">
        <button
          className="btn aiExplainBtn"
          onClick={handleExplain}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <span className="aiLoadingRow">
              <span className="aiSpinner" aria-hidden="true" />
              Generating…
            </span>
          ) : (
            '✨ Explain Code'
          )}
        </button>
        {explanation && (
          <button
            className="btn aiCopyBtn"
            onClick={handleCopy}
            title="Copy explanation to clipboard"
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
        )}
      </div>

      {/* Selection badge */}
      {isSelection && explanation && (
        <div className="aiSelectionBadge">
          📌 Explaining selected code only
        </div>
      )}

      {/* Body */}
      <div className="aiPanelBody">
        {error && (
          <div className="aiError" role="alert">
            <span className="aiErrorIcon">⚠️</span>
            {error}
          </div>
        )}

        {!error && !explanation && !isLoading && (
          <div className="aiPlaceholder">
            <p>Click <strong>Explain Code</strong> to get a beginner-friendly explanation of the code in the editor.</p>
            <p>Tip: select a specific snippet first to explain just that part.</p>
          </div>
        )}

        {isLoading && (
          <div className="aiLoadingMessage" aria-live="polite">
            <div className="aiPulse" />
            <span>Asking Gemini AI…</span>
          </div>
        )}

        {explanation && !isLoading && (
          <div className="aiExplanation" aria-live="polite">
            {renderExplanation(explanation)}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIExplainerPanel;
