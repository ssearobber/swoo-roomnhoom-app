import { Spinner } from "@shopify/polaris";

export default function LoadingSpinner() {
  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 1000,
      color: '#2E3E38'
    }}>
      <Spinner size="large" />
    </div>
  );
} 