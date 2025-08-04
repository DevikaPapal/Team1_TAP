import React from "react";
import PortfolioLineChart from "../components/PortfolioLineChart.jsx";

function ProfitLoss() {
  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h2>Profit/Loss</h2>
      <h2>Daily Portfolio Value</h2>
      <PortfolioLineChart />
    </div>
  );
}

export default ProfitLoss;
