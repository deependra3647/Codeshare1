/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef } from 'react';
import Codemirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';

// Language modes
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/python/python';
import 'codemirror/mode/clike/clike';       // Java, C, C++, C#, Kotlin
import 'codemirror/mode/php/php';
import 'codemirror/mode/ruby/ruby';
import 'codemirror/mode/go/go';
import 'codemirror/mode/rust/rust';
import 'codemirror/mode/htmlmixed/htmlmixed';
import 'codemirror/mode/css/css';
import 'codemirror/mode/sql/sql';
import 'codemirror/mode/swift/swift';

import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';

import ACTIONS from '../Actions';

const Editor = ({ socketRef, roomId, canWrite = true, language, templateCode, onCodeChange, onEditorReady }) => {
  const editorRef = useRef(null);

  // Initialize CodeMirror once
  useEffect(() => {
    async function init() {
      editorRef.current = Codemirror.fromTextArea(
        document.getElementById('realtimeEditor'),
        {
          mode: { name: 'javascript', json: false },
          theme: 'dracula',
          autoCloseTags: true,
          autoCloseBrackets: true,
          lineNumbers: true,
          readOnly: !canWrite,
          indentUnit: 2,
          tabSize: 2,
          indentWithTabs: false,
        }
      );

      editorRef.current.on('change', (instance, changes) => {
        const { origin } = changes;
        const code = instance.getValue();
        onCodeChange(code);
        if (origin !== 'setValue' && socketRef.current && canWrite) {
          socketRef.current.emit(ACTIONS.CODE_CHANGE, { roomId, code });
        }
      });
      setTimeout(() => editorRef.current && editorRef.current.refresh(), 0);

      // Expose the CodeMirror instance to the parent (for selection reads, etc.)
      if (onEditorReady) onEditorReady(editorRef.current);
    }
    init();
  }, []);

  // Update readOnly when canWrite changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setOption('readOnly', !canWrite);
    }
  }, [canWrite]);

  // Switch mode AND inject template when language changes
  useEffect(() => {
    if (!editorRef.current || !language) return;
    editorRef.current.setOption('mode', language.mode);

    // templateCode is set only when the user explicitly changes language
    if (templateCode !== undefined && templateCode !== null) {
      editorRef.current.setValue(templateCode);
      // Move cursor to end
      editorRef.current.setCursor(editorRef.current.lineCount(), 0);
    }
  }, [language, templateCode]);

  // Listen for remote CODE_CHANGE (from other users)
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleCodeChange = ({ code }) => {
      if (editorRef.current && code !== null && code !== undefined) {
        if (editorRef.current.getValue() !== code) {
          editorRef.current.setValue(code);
        }
      }
    };

    socket.on(ACTIONS.CODE_CHANGE, handleCodeChange);
    return () => socket.off(ACTIONS.CODE_CHANGE, handleCodeChange);
  }, []);

  return <textarea id="realtimeEditor"></textarea>;
};

export default Editor;
