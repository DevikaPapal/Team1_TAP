import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Trades from "./pages/Trades";
import ProfitLoss from "./pages/ProfitLoss";

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        {/* Top Navbar */}
        <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
          <h1 className="text-lg font-bold">Personal Portfolio</h1>

          {/* Horizontal Navigation Links */}
          <nav className="flex space-x-6">
            <Link to="/"
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors duration-200">
              Home
            </Link>
            <Link to="/trades"
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors duration-200">
              Trades
            </Link>
            <Link to="/profitloss"
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors duration-200">
              Profit/Loss
            </Link>
          </nav>
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
