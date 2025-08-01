import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Trades from "./pages/Trades";
import ProfitLoss from "./pages/ProfitLoss";
import Dropdown from "./components/dropdown";

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        {/* Top Navbar */}
        <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
          <h1 className="text-lg font-bold">Personal Portfolio</h1>

          {/* Dropdown aligned to the right */}
          <Dropdown />
        </div>

        {/* Page Content */}
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/profitloss" element={<ProfitLoss />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
