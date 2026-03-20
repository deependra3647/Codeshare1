import React, { useEffect, useRef } from 'react';
import Codemirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';
import ACTIONS from '../Actions';

const Editor = ({socketRef, roomId, canWrite = true, onCodeChange}) => {
  const editorRef = useRef(null);
  const codeChangeHandlerRef = useRef(null);
  
  useEffect(() =>{
    async function init(){
      editorRef.current = Codemirror.fromTextArea(
        document.getElementById("realtimeEditor"),
        {
          mode: {name: "javascript", json: true},
          theme: 'dracula',
          autoCloseTags: true,
          autoCloseBrackets: true,
          lineNumbers: true,
          readOnly: !canWrite,
        }
      );

      editorRef.current.on('change',(instance, changes)=>{
        console.log('changes', changes);
        const {origin} = changes;
        const code = instance.getValue();
        onCodeChange(code);
        if(origin !== 'setValue' && socketRef.current && canWrite){
          socketRef.current.emit(ACTIONS.CODE_CHANGE,{
            roomId,
            code,
          });
        }
        console.log(code);
      });
    }
    init();
  },[]);

  useEffect(() => {
    if(editorRef.current) {
      editorRef.current.setOption('readOnly', !canWrite);
    }
  }, [canWrite]);

  // Set up code change listener when socket is available
  useEffect(() =>{
    if(socketRef.current){
      const handleCodeChange = ({code}) => {
        // Wait for editor to be initialized
        if(editorRef.current && code !== null && code !== undefined){
          const currentCode = editorRef.current.getValue();
          // Only update if code is different to avoid unnecessary updates
          if(currentCode !== code){
            editorRef.current.setValue(code);
          }
        }
      };
      
      codeChangeHandlerRef.current = handleCodeChange;
      socketRef.current.on(ACTIONS.CODE_CHANGE, handleCodeChange);

      return () => {
        if(socketRef.current && codeChangeHandlerRef.current){
          socketRef.current.off(ACTIONS.CODE_CHANGE, codeChangeHandlerRef.current);
        }
      };
    }
  },[socketRef.current]);


  return (
    <textarea id="realtimeEditor"></textarea>
  )
}
export default Editor;