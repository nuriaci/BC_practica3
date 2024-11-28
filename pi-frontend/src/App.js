import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import UploadFile from './components/UploadFile';
import RegistrarDisputa from './components/RegistrarDisputa';
import VisualizarDisputas from './components/VisualizarDisputas';
import '@fontsource/inter'; // Importa la fuente Inter

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<UploadFile />} />
          <Route path="/disputa" element={<RegistrarDisputa />} />
          <Route path="/visualizarDisputa" element={<VisualizarDisputas />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
