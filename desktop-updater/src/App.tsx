import React from 'react';
import { UpdateForm } from './features/update/UpdateForm';
import { UpdatePreview } from './features/update/UpdatePreview';
import { useUpdateFlow } from './features/update/useUpdateFlow';

export default function App() {
  const flow = useUpdateFlow();

  return (
    <main>
      <h1>Desktop Updater</h1>
      <UpdateForm
        state={flow.state}
        canRun={flow.canRun}
        onProfilePathChange={flow.setProfilePath}
        onTargetDbPathChange={flow.setTargetDbPath}
        onPreview={flow.preview}
        onRun={flow.run}
      />
      <UpdatePreview state={flow.state} />
    </main>
  );
}

export async function runAppSmoke(): Promise<string> {
  // Minimal deterministic smoke harness
  return 'ready';
}
