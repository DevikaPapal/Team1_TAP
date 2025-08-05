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

  // Transaction history state
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState(null);
  const [previousStocks, setPreviousStocks] = useState([]);

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingTrade, setPendingTrade] = useState(null);

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
      // Fetch transactions after portfolio is loaded
      if (data.id) {
        fetchTransactions(data.id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (portfolioId) => {
    try {
      setTransactionsLoading(true);
      const response = await fetch(`http://localhost:5001/transactions/${portfolioId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }
      const data = await response.json();
      setTransactions(data);
      
      // Extract unique stock tickers from transactions for previous stocks
      const uniqueTickers = [...new Set(data.map(transaction => transaction.ticker))];
      setPreviousStocks(uniqueTickers);
    } catch (err) {
      setTransactionsError(err.message);
    } finally {
      setTransactionsLoading(false);
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

  // Helper function to search for a specific ticker
  const searchSpecificStock = async (ticker) => {
    try {
      setSearchLoading(true);
      setSearchError(null);
      setSearchTicker(ticker);
      
      const response = await fetch(`http://localhost:5001/quote/${ticker}`);
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

    // Show confirmation dialog instead of executing immediately
    setPendingTrade({
      type: transactionType,
      ticker: tradeTicker.toUpperCase(),
      quantity: tradeQuantity,
      price: tradeQuote?.price || 0,
      total: (tradeQuote?.price || 0) * parseFloat(tradeQuantity || 0)
    });
    setShowConfirmDialog(true);
  };

  const confirmTrade = async () => {
    if (!pendingTrade) return;

    try {
      setTradeLoading(true);
      setTradeError(null);
      setTradeMessage(null);
      setShowConfirmDialog(false);

      const response = await fetch("http://localhost:5001/trade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          portfolio_id: portfolio.id,
          ticker: pendingTrade.ticker,
          quantity: pendingTrade.quantity,
          transaction_type: pendingTrade.type
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Trade failed");
      }

      setTradeMessage(`${pendingTrade.type.charAt(0).toUpperCase() + pendingTrade.type.slice(1)} order successful: ${pendingTrade.quantity} shares of ${pendingTrade.ticker} at $${data.price}`);
      
      // Refresh portfolio data and transactions
      await fetchPortfolio();
      
      // Clear form
      setTradeTicker("");
      setTradeQuantity("");
      setTradeQuote(null);
      setPendingTrade(null);
      
    } catch (err) {
      setTradeError(err.message);
    } finally {
      setTradeLoading(false);
    }
  };

  const cancelTrade = () => {
    setShowConfirmDialog(false);
    setPendingTrade(null);
  };

  // Helper function to format market cap
  const formatMarketCap = (marketCap) => {
    if (marketCap >= 1000000000) {
      return `$${(marketCap / 1000000000).toFixed(2)}B`;
    } else if (marketCap >= 1000000) {
      return `$${(marketCap / 1000000).toFixed(2)}M`;
    } else if (marketCap >= 1000) {
      return `$${(marketCap / 1000).toFixed(2)}K`;
    } else {
      return `$${marketCap.toFixed(2)}`;
    }
  };

  // Helper function to render stock details
  const renderStockDetails = (stockData) => {
    const fields = [
      {
        key: 'day_range',
        label: 'Day Range',
        value: `$${stockData.day_low?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} - $${stockData.day_high?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
        condition: stockData.day_low && stockData.day_high
      },
      {
        key: 'week_52_range',
        label: '52-Week Range',
        value: `$${stockData.week_52_low?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} - $${stockData.week_52_high?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
        condition: stockData.week_52_high && stockData.week_52_low
      },
      {
        key: 'volume',
        label: 'Volume',
        value: stockData.volume?.toLocaleString(),
        condition: stockData.volume
      },
      {
        key: 'market_cap',
        label: 'Market Cap',
        value: formatMarketCap(stockData.market_cap),
        condition: stockData.market_cap > 0
      },
      {
        key: 'pe_ratio',
        label: 'P/E Ratio',
        value: stockData.pe_ratio?.toFixed(2),
        condition: stockData.pe_ratio && stockData.pe_ratio > 0
      },
      {
        key: 'dividend_yield',
        label: 'Dividend Yield',
        value: `${(stockData.dividend_yield * 100).toFixed(2)}%`,
        condition: stockData.dividend_yield && stockData.dividend_yield > 0
      },
      {
        key: 'beta',
        label: 'Beta',
        value: stockData.beta?.toFixed(2),
        condition: stockData.beta
      },
      {
        key: 'sector',
        label: 'Sector',
        value: stockData.sector,
        condition: stockData.sector && stockData.sector !== 'N/A'
      },
      {
        key: 'industry',
        label: 'Industry',
        value: stockData.industry,
        condition: stockData.industry && stockData.industry !== 'N/A'
      }
    ];

    return fields
      .filter(field => field.condition)
      .map(field => (
        <div key={field.key} className="quote-detail-row">
          <span>{field.label}:</span>
          <span>{field.value}</span>
        </div>
      ));
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
          <p className="section-description">
            Search for any stock to view detailed information including price, market data, and company details.
          </p>
          
          <div className="search-input-container">
            <input
              type="text"
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
              placeholder="Enter ticker symbol (e.g., AAPL, GOOGL, MSFT)"
              className="search-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  searchStock();
                }
              }}
            />
            <div className="search-buttons">
              <button
                onClick={searchStock}
                disabled={searchLoading}
                className="search-button"
              >
                {searchLoading ? "Searching..." : "Search"}
              </button>
              <button
                onClick={() => {
                  setSearchResult(null);
                  setSearchTicker("");
                  setSearchError(null);
                }}
                className="search-button clear-button"
                disabled={searchLoading}
              >
                Clear
              </button>
              {searchResult && (
                <button
                  onClick={() => searchSpecificStock(searchResult.ticker)}
                  disabled={searchLoading}
                  className="search-button refresh-button"
                >
                  {searchLoading ? "Refreshing..." : "Refresh"}
                </button>
              )}
            </div>
          </div>

          <div className="stocks-sections-container">
            <div className="popular-stocks">
              <p className="popular-stocks-label">Popular stocks:</p>
              <div className="popular-stock-buttons">
                {['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'].map(ticker => (
                  <button
                    key={ticker}
                    onClick={() => searchSpecificStock(ticker)}
                    className="popular-stock-button"
                    disabled={searchLoading}
                  >
                    {ticker}
                  </button>
                ))}
              </div>
            </div>

            {previousStocks.length > 0 && (
              <div className="popular-stocks">
                <p className="popular-stocks-label">Your previous stocks:</p>
                <div className="popular-stock-buttons">
                  {previousStocks.slice(0, 5).map(ticker => (
                    <button
                      key={ticker}
                      onClick={() => searchSpecificStock(ticker)}
                      className="popular-stock-button previous-stock-button"
                      disabled={searchLoading}
                    >
                      {ticker}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {searchError && (
            <div className="error-message">
              {searchError}
            </div>
          )}

          {searchResult && (
            <div className="search-result">
              <div className="quote-header">
                <h4>{searchResult.name} ({searchResult.ticker})</h4>
              </div>
              
              <div className="quote-price-section">
                <p className="quote-main-price">
                  <strong>${searchResult.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                </p>
                <p className={searchResult.change >= 0 ? "positive-change" : "negative-change"}>
                  ${searchResult.change.toFixed(2)} ({searchResult.percent_change.toFixed(2)}%)
                </p>
              </div>

              <div className="quote-details">
                {renderStockDetails(searchResult)}
              </div>

              <div className="search-actions">
                <button
                  onClick={() => {
                    setTradeTicker(searchResult.ticker);
                    fetchTradeQuote(searchResult.ticker);
                    // Clear the search results from the left side
                    setSearchResult(null);
                    setSearchTicker("");
                  }}
                  className="trade-this-stock-button"
                >
                  Trade This Stock
                </button>
              </div>
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
              <div className="quote-header">
                <h4>{tradeQuote.name} ({tradeQuote.ticker})</h4>
              </div>
              
              <div className="quote-price-section">
                <p className="quote-main-price">
                  <strong>${tradeQuote.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                </p>
                <p className={tradeQuote.change >= 0 ? "positive-change" : "negative-change"}>
                  ${tradeQuote.change.toFixed(2)} ({tradeQuote.percent_change.toFixed(2)}%)
                </p>
              </div>

              <div className="quote-details">
                {renderStockDetails(tradeQuote)}
              </div>

              {tradeQuantity && (
                <div className="estimated-total">
                  <p><strong>Estimated Total: ${(tradeQuote.price * parseFloat(tradeQuantity || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></p>
                </div>
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

      {/* Transaction History Section */}
      <div className="trading-section" style={{ marginTop: "30px" }}>
        <h3>Transaction History</h3>
        
        {transactionsLoading && (
          <div className="loading-container">
            <p>Loading transactions...</p>
          </div>
        )}

        {transactionsError && (
          <div className="error-message">
            {transactionsError}
          </div>
        )}

        {!transactionsLoading && !transactionsError && (
          <div className="holdings-table-container">
            {transactions.length === 0 ? (
              <div className="no-holdings">
                <p>No transactions found.</p>
              </div>
            ) : (
              <table className="holdings-table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell table-header-cell-left">Date</th>
                    <th className="table-header-cell table-header-cell-left">Ticker</th>
                    <th className="table-header-cell table-header-cell-left">Type</th>
                    <th className="table-header-cell table-header-cell-left">Quantity</th>
                    <th className="table-header-cell table-header-cell-left">Price</th>
                    <th className="table-header-cell table-header-cell-left">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction, index) => (
                    <tr key={transaction.id} className={index % 2 === 0 ? "table-row-even" : "table-row-odd"}>
                      <td className="table-cell table-cell-left">
                        {new Date(transaction.transaction_date).toLocaleDateString()}
                      </td>
                      <td className="table-cell table-cell-left">
                        {transaction.ticker}
                      </td>
                      <td className="table-cell table-cell-left">
                        <span className={transaction.transaction_type === 'buy' ? 'positive-change' : 'negative-change'}>
                          {transaction.transaction_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="table-cell table-cell-left">
                        {parseFloat(transaction.quantity).toLocaleString()}
                      </td>
                      <td className="table-cell table-cell-left">
                        ${parseFloat(transaction.price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                      <td className="table-cell table-cell-left">
                        ${(parseFloat(transaction.price) * parseFloat(transaction.quantity)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && pendingTrade && (
        <div className="confirmation-overlay">
          <div className="confirmation-dialog">
            <h3>Confirm Trade</h3>
            <div className="confirmation-details">
              <p><strong>Action:</strong> {pendingTrade.type.toUpperCase()}</p>
              <p><strong>Stock:</strong> {pendingTrade.ticker}</p>
              <p><strong>Quantity:</strong> {pendingTrade.quantity} shares</p>
              <p><strong>Price:</strong> ${pendingTrade.price.toFixed(2)} per share</p>
              <p><strong>Total:</strong> ${pendingTrade.total.toFixed(2)}</p>
            </div>
            <div className="confirmation-buttons">
              <button 
                onClick={confirmTrade} 
                className={`trade-button ${pendingTrade.type === 'buy' ? 'buy-button' : 'sell-button'}`}
                disabled={tradeLoading}
              >
                {tradeLoading ? "Processing..." : `Confirm ${pendingTrade.type.toUpperCase()}`}
              </button>
              <button 
                onClick={cancelTrade} 
                className="trade-button cancel-button"
                disabled={tradeLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Trades;