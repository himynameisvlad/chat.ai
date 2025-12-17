import { Chat } from './components/Chat';
import { useSSE } from './hooks/useSSE';
import { useToastContainer } from './components/Toast';

function App() {
  const { showToast, ToastContainer } = useToastContainer();

  // Connect to SSE for real-time notifications
  useSSE({
    onToast: (toast) => {
      showToast(toast.message);
    },
    onConnected: (connectionId) => {
      console.log('SSE connected:', connectionId);
    },
    onError: (error) => {
      console.error('SSE error:', error);
    },
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
