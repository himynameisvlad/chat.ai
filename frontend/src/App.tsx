import { useCallback } from 'react';
import { Chat } from './components/Chat';
import { useSSE } from './hooks/useSSE';
import type { ToastEvent } from './hooks/useSSE';
import { useToastContainer } from './components/Toast';

function App() {
  const { showToast, ToastContainer } = useToastContainer();

  const handleToast = useCallback((toast: ToastEvent) => {
    showToast(toast.message);
  }, [showToast]);

  // Connect to SSE for real-time notifications
  useSSE({
    onToast: handleToast,
    enabled: true,
  });

  return (
    <>
      <Chat />
      <ToastContainer />
    </>
  );
}

export default App;
