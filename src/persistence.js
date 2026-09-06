import {useEffect, useRef, useState} from 'react';

export async function readWorkspace() {
  const response = await fetch('/api/state');
  if (!response.ok) throw new Error('Cannot load the saved draft. Check the server and retry.');
  return response.json();
}
export async function writeWorkspace(state, revision) {
  const response = await fetch('/api/state', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({state, revision})});
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'Could not save the draft.');
    error.conflict = response.status === 409;
    throw error;
  }
  return result.revision;
}

export function useWorkspace(initial) {
  const [state, setState] = useState(initial.state);
  const [status, setStatus] = useState('Saved to PostgreSQL');
  const [saveError, setSaveError] = useState(null);
  const current = useRef(initial.state), revision = useRef(initial.revision);
  const pending = useRef(false), running = useRef(false), failure = useRef(null);
  async function flush() {
    if (running.current || failure.current) return;
    running.current = true;
    try {
      while (pending.current) {
        pending.current = false;
        const value = current.current;
        setStatus('Saving…');
        revision.current = await writeWorkspace(value, revision.current);
      }
      setStatus('Saved to PostgreSQL');
    } catch (error) {
      pending.current = true;
      failure.current = error;
      setSaveError(error);
      setStatus('Changes not saved');
    } finally {running.current = false;}
  }
  function update(next) {
    current.current = typeof next === 'function' ? next(current.current) : next;
    setState(current.current);
    pending.current = true;
    void flush();
  }
  function retry() {failure.current = null; setSaveError(null); void flush();}
  useEffect(() => {
    const warn = event => {if (pending.current || running.current) {event.preventDefault(); event.returnValue = '';}};
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  return {state, update, status, saveError, retry};
}
