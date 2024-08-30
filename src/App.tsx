import React, { useEffect, useRef, useState, useCallback } from 'react';
import { openDB, deleteDB } from 'idb';

const offset = 5;
const itemHeight = 25;

type VisibleLogs = {
  id: number;
  log: string;
}
function LogViewer() {
  const [visibleLogs, setVisibleLogs] = useState<VisibleLogs[]>([]);
  const [totalLogCount, setTotalLogCount] = useState<number>(0); 
  const [loading, setLoading] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const logsPerPage = ((containerRef.current?.clientHeight || 1) / itemHeight) + offset;

  const dbPromise = openDB('logs-db', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('logs')) {
        db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
      }
    }
  });

  const persistLogsToIndexedDB = async (logsToPersist: string[]) => {
    const db = await dbPromise;
    const tx = db.transaction('logs', 'readwrite');
    const store = tx.objectStore('logs');
    for (const log of logsToPersist) {
      await store.put({ log });
    }
    await tx.done;
    const logsLength = await db.count('logs')
    setTotalLogCount(logsLength)

    const scrollTop = containerRef.current?.scrollTop || 1
    const startFromItemIndex = Math.round(scrollTop / itemHeight) - offset
    if(!autoScroll){
      await loadLogsFromIndexedDB(startFromItemIndex - logsPerPage, startFromItemIndex)
    }
  };

  const loadLogsFromIndexedDB = async (offset = 0, limit = logsPerPage) => {
    const db = await dbPromise;
    const tx = db.transaction('logs', 'readonly');
    const store = tx.objectStore('logs');
    const logsFromDB = await store.getAll(IDBKeyRange.bound(offset, limit));
    if (!containerRef.current) return;

    if (autoScroll) {
      if (logsFromDB.length < logsPerPage) {
        containerRef.current.scrollTop =+ 1
      }
      setVisibleLogs(logsFromDB.splice(logsFromDB.length - logsPerPage))
    } else {
      setVisibleLogs(logsFromDB)
    }
  };


  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response: any = await fetch('https://test-log-viewer-backend.stg.onepunch.agency/view-log', {
        method: 'GET',
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        await persistLogsToIndexedDB(lines);
      }
      
    } catch (error) {
      console.error('error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight + 150;
    }
  }, [visibleLogs, autoScroll, loading]);

  const toggleAutoScroll = () => {
    setAutoScroll(!autoScroll);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <button onClick={toggleAutoScroll}>
          {autoScroll ? 'disable auto-scroll' : 'enable auto-scroll'}
        </button>
        <button onClick={() => {
          deleteDB('logs-db')
          setVisibleLogs([])
          setLoading(false)
          setTotalLogCount(0)
          caches.keys().then((cacheNames) => {
            cacheNames.forEach((cacheName) => {
              caches.delete(cacheName);
            });
          });
          window.location.reload()
        }}>
          clear database
        </button>
      </div>
      <div
        ref={containerRef}
        onScroll={(e) => {
          const scrollTop = containerRef.current?.scrollTop || 1
          const startFromItemIndex = Math.round(scrollTop / itemHeight)
          loadLogsFromIndexedDB(startFromItemIndex, startFromItemIndex + 1000)
        }}
        style={{
          height: '80vh',
          overflowY: 'auto',
          padding: '10px',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          position: 'relative',
        }}
      >
        <div
        style={{
          height: `${totalLogCount * (itemHeight)}px`,
          width: 'min(100vw, 50rem)',
          minHeight: 'min(100vh, 50rem)',
        }}
        >logs container

        </div>
          {visibleLogs.map(item => (
            <pre key={item.id} style={{ top: `${item.id * itemHeight}px`, position: 'absolute'}}>{item.id} {item.log}</pre>
          ))}
      </div>
    </div>
  );
}

export default LogViewer;
