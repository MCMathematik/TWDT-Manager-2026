
import React from 'react';

// This file is deprecated. Please use src/App.tsx
// The application entry point has been updated to point to src/App.tsx

export default function App() {
  return (
    <div className="flex items-center justify-center h-screen bg-black text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">Configuration Error</h1>
        <p>This file (root App.tsx) is deprecated.</p>
        <p>Please ensure index.tsx imports from ./src/App</p>
      </div>
    </div>
  );
}
