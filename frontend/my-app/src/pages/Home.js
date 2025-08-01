import React, { useState, useEffect } from "react";

function Home() {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPortfolio();
  }, []);
  /*trying to push*/
  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5001/portfolio");
      if (!response.ok) {
        throw new Error("Failed to fetch portfolio");
      }
      const data = await response.json();
      setPortfolio(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Loading Portfolio...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Error Loading Portfolio</h2>
        <p>{error}</p>
        <button onClick={fetchPortfolio}>Retry</button>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>No Portfolio Data</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      {/* Portfolio Summary */}
      <div style={{ marginBottom: "20px", textAlign: "center" }}>
        <h2>Portfolio Summary</h2>
        <p>Cash Balance: ${portfolio.cash_balance.toLocaleString()}</p>
        <p>Total Portfolio Value: ${portfolio.total_value.toLocaleString()}</p>
        <p>Holdings: {portfolio.holdings.length}</p>
      </div>

      {/* Holdings Table */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <table
          style={{
            borderCollapse: "collapse",
            width: "60%",
            textAlign: "center",
          }}
        >
          <thead>
            <tr>
              <th style={{ border: "1px solid black", padding: "10px" }}>
                Ticker
              </th>
              <th style={{ border: "1px solid black", padding: "10px" }}>
                Quantity
              </th>
              <th style={{ border: "1px solid black", padding: "10px" }}>
                Cost Basis
              </th>
              <th style={{ border: "1px solid black", padding: "10px" }}>
                Current Price
              </th>
              <th style={{ border: "1px solid black", padding: "10px" }}>
                Market Value
              </th>
              <th style={{ border: "1px solid black", padding: "10px" }}>
                Unrealized P&L
              </th>
            </tr>
          </thead>
          <tbody>
            {portfolio.holdings.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  style={{ border: "1px solid black", padding: "10px" }}
                >
                  No holdings yet. Start trading to see your portfolio!
                </td>
              </tr>
            ) : (
              portfolio.holdings.map((holding, index) => (
                <tr key={index}>
                  <td style={{ border: "1px solid black", padding: "10px" }}>
                    {holding.ticker}
                  </td>
                  <td style={{ border: "1px solid black", padding: "10px" }}>
                    {holding.quantity}
                  </td>
                  <td style={{ border: "1px solid black", padding: "10px" }}>
                    ${holding.cost_basis}
                  </td>
                  <td style={{ border: "1px solid black", padding: "10px" }}>
                    ${holding.current_price}
                  </td>
                  <td style={{ border: "1px solid black", padding: "10px" }}>
                    ${holding.market_value.toLocaleString()}
                  </td>
                  <td
                    style={{
                      border: "1px solid black",
                      padding: "10px",
                      color: holding.unrealized_pnl >= 0 ? "green" : "red",
                    }}
                  >
                    ${holding.unrealized_pnl.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Home;
