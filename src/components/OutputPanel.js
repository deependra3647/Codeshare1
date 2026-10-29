import React from 'react';

const OutputPanel = ({ output, error, isRunning, previewHtml, stdin, onStdinChange }) => {
  const hasError   = Boolean(error);
  const hasOutput  = Boolean(output);
  const isIdle     = !isRunning && !hasOutput && !hasError && !previewHtml;

  return (
    <aside className="outputPanel">

      {/* ── stdin ── */}
      <div className="stdinSection">
        <div className="outputPanelHeader">stdin (User Input)</div>
        <textarea
          className="stdinInput"
          placeholder="Enter program input here (one value per line)..."
          value={stdin}
          onChange={(e) => onStdinChange(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* ── output ── */}
      <div className="outputSection">
        <div className="outputPanelHeader">Output / Console</div>
        <div className="outputPanelBody">
          {isRunning && <pre className="outputRunning">Running...</pre>}
          {hasOutput  && <pre className="outputStdout">{output}</pre>}
          {hasError   && <pre className="outputStderr">{error}</pre>}
          {previewHtml && (
            <iframe
              className="outputPreview"
              title="HTML/CSS preview"
              sandbox="allow-scripts"
              srcDoc={previewHtml}
            />
          )}
          {isIdle && (
            <pre className="outputPlaceholder">
              Click Run to execute your code.{'\n'}Output and errors will appear here.
            </pre>
          )}
        </div>
      </div>

    </aside>
  );
};

export default OutputPanel;
