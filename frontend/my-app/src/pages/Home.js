import React from "react";

function Home() {
  const dummyPortfolio = {
    cashBalance: 10000,
    totalValue: 25000,
    holdings: [
      { ticker: "AAPL", quantity: 10, currentPrice: 150 },
      { ticker: "TSLA", quantity: 5, currentPrice: 700 },
    ],
  };

  return (
    <div style={{ padding: "20px" }}>
      {/* Portfolio Summary */}
      <div style={{ marginBottom: "20px", textAlign: "center" }}>
        <h2>Portfolio Summary</h2>
        <p>Cash Balance: ${dummyPortfolio.cashBalance.toLocaleString()}</p>
        <p>Total Holdings Value: ${dummyPortfolio.totalValue.toLocaleString()}</p>
        <p>Holdings: {dummyPortfolio.holdings.length}</p>
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
              <th style={{ border: "1px solid black", padding: "10px" }}>Ticker</th>
              <th style={{ border: "1px solid black", padding: "10px" }}>Quantity</th>
              <th style={{ border: "1px solid black", padding: "10px" }}>Current Price</th>
              <th style={{ border: "1px solid black", padding: "10px" }}>Market Value</th>
            </tr>
          </thead>
          <tbody>
            {dummyPortfolio.holdings.map((h, index) => (
              <tr key={index}>
                <td style={{ border: "1px solid black", padding: "10px" }}>{h.ticker}</td>
                <td style={{ border: "1px solid black", padding: "10px" }}>{h.quantity}</td>
                <td style={{ border: "1px solid black", padding: "10px" }}>${h.currentPrice}</td>
                <td style={{ border: "1px solid black", padding: "10px" }}>
                  ${(h.quantity * h.currentPrice).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Home;
