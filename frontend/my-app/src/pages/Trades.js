import React, { useState, useEffect } from "react";
import "./Trades.css";

function Trades() {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search section state
  const [searchTicker, setSearchTicker] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Trade section state
  const [tradeTicker, setTradeTicker] = useState("");
  const [tradeQuantity, setTradeQuantity] = useState("");
  const [tradeQuote, setTradeQuote] = useState(null);
  const [tradeError, setTradeError] = useState(null);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeMessage, setTradeMessage] = useState(null);

  useEffect(() => {
    fetchPortfolio();
  }, []);

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

  const searchStock = async () => {
    if (!searchTicker.trim()) {
      setSearchError("Please enter a ticker symbol");
      return;
    }

    try {
      setSearchLoading(true);
      setSearchError(null);
      const response = await fetch(`http://localhost:5001/quote/${searchTicker.toUpperCase()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch stock data");
      }
      const data = await response.json();
      setSearchResult(data);
    } catch (err) {
      setSearchError(`Error: ${err.message}`);
      setSearchResult(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchTradeQuote = async (ticker) => {
    if (!ticker.trim()) return;

    try {
      setTradeError(null);
      const response = await fetch(`http://localhost:5001/quote/${ticker.toUpperCase()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Invalid ticker");
      }
      const data = await response.json();
      setTradeQuote(data);
    } catch (err) {
      setTradeError(`Error: ${err.message}`);
      setTradeQuote(null);
    }
  };

  const handleTradeTickerChange = (e) => {
    const ticker = e.target.value;
    setTradeTicker(ticker);
    if (ticker.trim()) {
      fetchTradeQuote(ticker);
    } else {
      setTradeQuote(null);
      setTradeError(null);
    }
  };

  const executeTrade = async (transactionType) => {
    if (!tradeTicker.trim() || !tradeQuantity.trim()) {
      setTradeError("Please enter both ticker and quantity");
      return;
    }

    if (!portfolio) {
      setTradeError("Portfolio not loaded");
      return;
    }

    try {
      setTradeLoading(true);
      setTradeError(null);
      setTradeMessage(null);

      const response = await fetch("http://localhost:5001/trade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          portfolio_id: portfolio.id,
          ticker: tradeTicker.toUpperCase(),
          quantity: tradeQuantity,
          transaction_type: transactionType
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Trade failed");
      }

      setTradeMessage(`${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} order successful: ${tradeQuantity} shares of ${tradeTicker.toUpperCase()} at $${data.price}`);
      
      // Refresh portfolio data
      await fetchPortfolio();
      
      // Clear form
      setTradeTicker("");
      setTradeQuantity("");
      setTradeQuote(null);
      
    } catch (err) {
      setTradeError(err.message);
    } finally {
      setTradeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <h2>Loading Portfolio...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error Loading Portfolio</h2>
        <p>{error}</p>
        <button onClick={fetchPortfolio}>Retry</button>
      </div>
    );
  }

  return (
    <div className="trades-container">
      {/* Portfolio Cash Balance */}
      <div className="portfolio-header">
        <h2>Trading Dashboard</h2>
        <p className="cash-balance">
          Cash Balance: ${portfolio?.cash_balance?.toLocaleString() || '0.00'}
        </p>
      </div>

      {/* Main Trading Interface */}
      <div className="trading-interface">
        
        {/* Left Side - Stock Search */}
        <div className="trading-section">
          <h3>Stock Lookup</h3>
          
          <div className="search-input-container">
            <input
              type="text"
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
              placeholder="Enter ticker symbol (e.g., AAPL)"
              className="search-input"
            />
            <button
              onClick={searchStock}
              disabled={searchLoading}
              className="search-button"
            >
              {searchLoading ? "Searching..." : "Search"}
            </button>
          </div>

          {searchError && (
            <div className="error-message">
              {searchError}
            </div>
          )}

          {searchResult && (
            <div className="search-result">
              <h4>{searchResult.name} ({searchResult.ticker})</h4>
              <p><strong>Current Price:</strong> ${searchResult.price}</p>
              <p className={searchResult.change >= 0 ? "positive-change" : "negative-change"}>
                <strong>Daily Change:</strong> ${searchResult.change} ({searchResult.percent_change}%)
              </p>
              <p><strong>Day High:</strong> ${searchResult.day_high}</p>
              <p><strong>Day Low:</strong> ${searchResult.day_low}</p>
              {searchResult.market_cap && (
                <p><strong>Market Cap:</strong> ${(searchResult.market_cap / 1000000000).toFixed(2)}B</p>
              )}
            </div>
          )}
        </div>

        {/* Right Side - Trade Execution */}
        <div className="trading-section">
          <h3>Execute Trade</h3>
          
          <div className="input-group">
            <label className="input-label">
              Stock Symbol:
            </label>
            <input
              type="text"
              value={tradeTicker}
              onChange={handleTradeTickerChange}
              placeholder="Enter ticker symbol"
              className="form-input"
            />
          </div>

          <div className="input-group">
            <label className="input-label">
              Quantity:
            </label>
            <input
              type="number"
              value={tradeQuantity}
              onChange={(e) => setTradeQuantity(e.target.value)}
              placeholder="Enter number of shares"
              min="1"
              step="1"
              className="form-input"
            />
          </div>

          {tradeQuote && (
            <div className="quote-display">
              <p><strong>Current Price:</strong> ${tradeQuote.price}</p>
              <p className={tradeQuote.change >= 0 ? "positive-change" : "negative-change"}>
                <strong>Daily Change:</strong> ${tradeQuote.change} ({tradeQuote.percent_change}%)
              </p>
              {tradeQuantity && (
                <p><strong>Estimated Total:</strong> ${(tradeQuote.price * parseFloat(tradeQuantity || 0)).toFixed(2)}</p>
              )}
            </div>
          )}

          {tradeError && (
            <div className="error-message">
              {tradeError}
            </div>
          )}

          {tradeMessage && (
            <div className="success-message">
              {tradeMessage}
            </div>
          )}

          <div className="trade-buttons">
            <button
              onClick={() => executeTrade("buy")}
              disabled={tradeLoading || !tradeTicker || !tradeQuantity}
              className="trade-button buy-button"
            >
              {tradeLoading ? "Processing..." : "BUY"}
            </button>
            <button
              onClick={() => executeTrade("sell")}
              disabled={tradeLoading || !tradeTicker || !tradeQuantity}
              className="trade-button sell-button"
            >
              {tradeLoading ? "Processing..." : "SELL"}
            </button>
          </div>
        </div>
      </div>

      {/* Current Holdings Section */}
      <div className="holdings-section">
        <h3>Current Holdings</h3>
        
        {portfolio?.holdings?.length === 0 ? (
          <div className="no-holdings">
            <p>No holdings yet. Start trading to build your portfolio!</p>
          </div>
        ) : (
          <div className="holdings-table-container">
            <table className="holdings-table">
              <thead>
                <tr className="table-header">
                  <th className="table-header-cell table-header-cell-left">
                    Ticker
                  </th>
                  <th className="table-header-cell table-header-cell-right">
                    Quantity
                  </th>
                  <th className="table-header-cell table-header-cell-right">
                    Avg Cost
                  </th>
                  <th className="table-header-cell table-header-cell-right">
                    Current Price
                  </th>
                  <th className="table-header-cell table-header-cell-right">
                    Market Value
                  </th>
                  <th className="table-header-cell table-header-cell-right">
                    Unrealized P&L
                  </th>
                </tr>
              </thead>
              <tbody>
                {portfolio?.holdings?.map((holding, index) => (
                  <tr key={index} className={index % 2 === 0 ? "table-row-even" : "table-row-odd"}>
                    <td className="table-cell table-cell-left">
                      {holding.ticker}
                    </td>
                    <td className="table-cell table-cell-right">
                      {holding.quantity}
                    </td>
                    <td className="table-cell table-cell-right">
                      ${parseFloat(holding.cost_basis).toFixed(2)}
                    </td>
                    <td className="table-cell table-cell-right">
                      ${parseFloat(holding.current_price).toFixed(2)}
                    </td>
                    <td className="table-cell table-cell-right">
                      ${holding.market_value?.toLocaleString()}
                    </td>
                    <td className={`table-cell table-cell-right ${holding.unrealized_pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                      ${holding.unrealized_pnl?.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="portfolio-summary">
              <div>
                <strong>Portfolio Summary:</strong>
              </div>
              <div className="summary-stats">
                <span>
                  <strong>Cash:</strong> ${portfolio?.cash_balance?.toLocaleString()}
                </span>
                <span>
                  <strong>Total Value:</strong> ${portfolio?.total_value?.toLocaleString()}
                </span>
                <span>
                  <strong>Holdings:</strong> {portfolio?.holdings?.length || 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Trades;