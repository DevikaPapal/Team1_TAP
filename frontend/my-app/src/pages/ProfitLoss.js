import React, { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import Tooltip from '@mui/material/Tooltip';
import { Line } from "react-chartjs-2";
import "./ProfitLoss.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

function ProfitLoss() {
  const [portfolio, setPortfolio] = useState(null);
  const [pnlData, setPnlData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [dailyHistoryData, setDailyHistoryData] = useState(null);
  const [selectedDays, setSelectedDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });


  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchDailyHistory();
  }, [selectedDays]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchPortfolioData();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchPortfolioData = async () => {
    try {
      // Fetch portfolio data silently without loading state
      const portfolioResponse = await fetch("http://localhost:5001/portfolio");
      if (portfolioResponse.ok) {
        const portfolioData = await portfolioResponse.json();
        setPortfolio(portfolioData);
      }

      // Fetch P&L data 
      const pnlResponse = await fetch("http://localhost:5001/pnl");
      if (pnlResponse.ok) {
        const pnlData = await pnlResponse.json();
        setPnlData(pnlData);
      }
    } catch (err) {
      console.log("Failed to fetch real-time portfolio data:", err.message);
    }
  };

  const fetchDailyHistory = async () => {
    try {
      const dailyHistoryResponse = await fetch(
        `http://localhost:5001/portfolio/daily-history/${selectedDays}`
      );
      if (!dailyHistoryResponse.ok) {
        throw new Error("Failed to fetch daily portfolio history");
      }
      const dailyHistoryData = await dailyHistoryResponse.json();
      setDailyHistoryData(dailyHistoryData);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch portfolio data
      const portfolioResponse = await fetch("http://localhost:5001/portfolio");
      if (!portfolioResponse.ok) {
        throw new Error("Failed to fetch portfolio");
      }
      const portfolioData = await portfolioResponse.json();
      setPortfolio(portfolioData);

      // Fetch P&L data
      const pnlResponse = await fetch("http://localhost:5001/pnl");
      if (!pnlResponse.ok) {
        throw new Error("Failed to fetch P&L data");
      }
      const pnlData = await pnlResponse.json();
      setPnlData(pnlData);

      // Fetch transaction history data
      const historyResponse = await fetch(
        "http://localhost:5001/portfolio/history"
      );
      if (!historyResponse.ok) {
        throw new Error("Failed to fetch transaction history");
      }
      const historyData = await historyResponse.json();
      setHistoryData(historyData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalPnl = () => {
    if (!pnlData) return 0;
    return pnlData.total_unrealized_pnl + pnlData.total_realized_pnl;
  };

  const calculateTotalReturnPercentage = () => {
    if (!pnlData || pnlData.total_cost_basis === 0) return 0;
    const totalPnl = calculateTotalPnl();
    return (totalPnl / pnlData.total_cost_basis) * 100;
  };

  const getPnlColor = (value) => {
    return value >= 0 ? "positive" : "negative";
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        // Third click: reset to default (unsorted)
        setSortConfig({ key: null, direction: 'asc' });
        return;
      }
    }
    setSortConfig({ key, direction });
  };

  const getSortedHoldings = () => {
    if (!portfolio?.holdings) return [];
    
    const sortableHoldings = [...portfolio.holdings];
    if (sortConfig.key) {
      sortableHoldings.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortConfig.key) {
          case 'ticker':
            aValue = a.ticker;
            bValue = b.ticker;
            break;
          case 'quantity':
            aValue = parseFloat(a.quantity);
            bValue = parseFloat(b.quantity);
            break;
          case 'cost_basis':
            aValue = parseFloat(a.cost_basis);
            bValue = parseFloat(b.cost_basis);
            break;
          case 'current_price':
            aValue = parseFloat(a.current_price);
            bValue = parseFloat(b.current_price);
            break;
          case 'market_value':
            aValue = parseFloat(a.market_value);
            bValue = parseFloat(b.market_value);
            break;
          case 'unrealized_pnl':
            aValue = parseFloat(a.unrealized_pnl);
            bValue = parseFloat(b.unrealized_pnl);
            break;
          case 'return':
            aValue = a.unrealized_pnl / (parseFloat(a.cost_basis) * parseFloat(a.quantity) || 1);
            bValue = b.unrealized_pnl / (parseFloat(b.cost_basis) * parseFloat(b.quantity) || 1);
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableHoldings;
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return ' ⇅';
    }
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const generatePnlChartData = () => {
    if (!dailyHistoryData || !portfolio || !pnlData) {
      console.log("Missing data:", { dailyHistoryData, portfolio, pnlData });
      return null;
    }

    // Extract data from the API response format
    const dailyHistory = dailyHistoryData.daily_history || [];
    const labels = dailyHistory.map((item) => {
      const date = new Date(item.date);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    });

    // Use the combined PnL from backend
    const pnlValues = dailyHistory.map((item) => item.combined_pnl || 0);
    if (pnlData && pnlValues.length > 0) {
      const currentTotalPnl =
        pnlData.total_unrealized_pnl + pnlData.total_realized_pnl;
      pnlValues[pnlValues.length - 1] = currentTotalPnl;
    }

    console.log("Chart data:", {
      dailyHistory: dailyHistory.length,
      labels,
      pnlValues,
      currentPnl: pnlData
        ? pnlData.total_unrealized_pnl + pnlData.total_realized_pnl
        : null,
    });

    const startValue = pnlValues[0];
    const endValue = pnlValues[pnlValues.length - 1];
    const totalReturn = endValue - startValue;
    const totalReturnPercent = ((totalReturn / startValue) * 100).toFixed(2);

    console.log("P&L values:", pnlValues);

    return {
      labels: labels,
      datasets: [
        {
          label: "Total P&L (Realized + Unrealized)",
          data: pnlValues,
          borderColor: totalReturn >= 0 ? "#22c55e" : "#ef4444",
          backgroundColor:
            totalReturn >= 0
              ? "rgba(34, 197, 94, 0.1)"
              : "rgba(239, 68, 68, 0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
      metadata: {
        totalReturn,
        totalReturnPercent,
        startValue,
        endValue,
        days: dailyHistory.length,
      },
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return (
              context.dataset.label + ": " + formatCurrency(context.parsed.y)
            );
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        min: function (context) {
          const values = context.chart.data.datasets[0].data;
          const minValue = Math.min(...values);
          return minValue - minValue * 0.01;
        },
        max: function (context) {
          const values = context.chart.data.datasets[0].data;
          const maxValue = Math.max(...values);
          return maxValue + maxValue * 0.01;
        },
        ticks: {
          callback: function (value) {
            return formatCurrency(value);
          },
        },
        title: {
          display: true,
          text: "Total P&L ($)",
        },
      },
      x: {
        display: true,
        title: {
          display: true,
          text: "Date",
        },
        ticks: {
          maxTicksLimit: 8,
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="loading-container">
        <h2>Loading Profit/Loss Data...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error Loading P&L Data</h2>
        <p>{error}</p>
        <button onClick={fetchData}>Retry</button>
      </div>
    );
  }
  
  const sortedHoldings = getSortedHoldings();

  return (
    <div className="pnl-container">
      {/* Header */}
      <div className="pnl-header">
        <h2>Profit & Loss</h2>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <h3>Total P&L</h3>
          <div className={`pnl-value ${getPnlColor(calculateTotalPnl())}`}>
            {formatCurrency(calculateTotalPnl())}
          </div>
          <div
            className={`pnl-percentage ${getPnlColor(
              calculateTotalReturnPercentage()
            )}`}
          >
            {formatPercentage(calculateTotalReturnPercentage())}
          </div>
        </div>

        <div className="summary-card">
          <h3>Portfolio Value</h3>
          <div className="pnl-value">
            {formatCurrency(portfolio?.total_value || 0)}
          </div>
        </div>
      </div>

      {/* P&L Chart Section */}
      <div className="chart-section">
        <div className="chart-header">
          <h3>Total P&L Performance Over Time</h3>
          <div className="chart-controls">
            <label htmlFor="days-select">Time Period:</label>
            <select
              id="days-select"
              value={selectedDays}
              onChange={(e) => setSelectedDays(Number(e.target.value))}
            >
              <option value={7}>7 Days</option>
              <option value={14}>14 Days</option>
              <option value={30}>30 Days</option>
              <option value={90}>90 Days</option>
            </select>
          </div>
        </div>
        <div className="chart-container">
          {(() => {
            console.log("Chart rendering check:", {
              dailyHistoryData: !!dailyHistoryData,
              generatePnlChartData: !!generatePnlChartData(),
            });
            return dailyHistoryData && generatePnlChartData() ? (
              <Line data={generatePnlChartData()} options={chartOptions} />
            ) : (
              <div className="chart-loading">
                <p>Loading chart data...</p>
                <p>
                  Debug: dailyHistoryData ={" "}
                  {dailyHistoryData ? "true" : "false"}
                </p>
                <p>
                  Debug: generatePnlChartData ={" "}
                  {generatePnlChartData() ? "true" : "false"}
                </p>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Portfolio Breakdown */}
      <div className="breakdown-section">
        <h3>Portfolio Breakdown</h3>
        <div className="breakdown-grid">
          <div className="breakdown-item">
            <span className="breakdown-label">Cash Balance:</span>
            <span className="breakdown-value">
              {formatCurrency(portfolio?.cash_balance || 0)}
            </span>
          </div>
          <div className="breakdown-item">
            <span className="breakdown-label">Holdings Value:</span>
            <span className="breakdown-value">
              {formatCurrency(
                (portfolio?.total_value || 0) - (portfolio?.cash_balance || 0)
              )}
            </span>
          </div>
          <div className="breakdown-item">
            <span className="breakdown-label">Total Cost Basis:</span>
            <span className="breakdown-value">
              {formatCurrency(pnlData?.total_cost_basis || 0)}
            </span>
          </div>
          <div className="breakdown-item">
            <span className="breakdown-label">Number of Holdings:</span>
            <span className="breakdown-value">
              {portfolio?.holdings?.length || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      {portfolio?.holdings && portfolio.holdings.length > 0 ? (
        <div className="holdings-section">
          <h3>Holdings Performance</h3>
          <div className="holdings-table-container">
            <table className="holdings-table">
              <thead>
                <tr>
                  <th 
                    onClick={() => handleSort('ticker')} 
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title="Click to sort by ticker"
                  >
                    Ticker{getSortIcon('ticker')}
                  </th>
                  <th 
                    onClick={() => handleSort('quantity')} 
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title="Click to sort by quantity"
                  >
                    Quantity{getSortIcon('quantity')}
                  </th>
                  <Tooltip title="Cost basis is calculated using the weighted average of all purchases for this holding." placement="top">
                    <th 
                      onClick={() => handleSort('cost_basis')} 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      title="Click to sort by cost basis"
                    >
                      Cost Basis{getSortIcon('cost_basis')}
                    </th>
                  </Tooltip>
                  <Tooltip title="Current price is the latest market price for this holding." placement="top">
                    <th 
                      onClick={() => handleSort('current_price')} 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      title="Click to sort by current price"
                    >
                      Current Price{getSortIcon('current_price')}
                    </th>
                  </Tooltip>
                  <Tooltip title="Market value is the current market price multiplied by the quantity held." placement="top">
                    <th 
                      onClick={() => handleSort('market_value')} 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      title="Click to sort by market value"
                    >
                      Market Value{getSortIcon('market_value')}
                    </th>
                  </Tooltip>
                  <Tooltip title="Unrealized P&L is the profit or loss if you were to sell this holding at the current market price." placement="top">
                    <th 
                      onClick={() => handleSort('unrealized_pnl')} 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      title="Click to sort by unrealized P&L"
                    >
                      Unrealized P&L{getSortIcon('unrealized_pnl')}
                    </th>
                  </Tooltip>
                  <Tooltip title="Return % is the percentage gain or loss relative to the cost basis of this holding." placement="top">
                  <th 
                    onClick={() => handleSort('return')} 
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title="Click to sort by unrealized P&L"
                  >
                    Return %{getSortIcon('return')}
                  </th>
                  </Tooltip>
                </tr>
              </thead>
              <tbody>
                {sortedHoldings.map((holding, index) => {
                  const unrealizedPnl = holding.unrealized_pnl || 0;
                  const costBasis =
                    parseFloat(holding.cost_basis) *
                    parseFloat(holding.quantity);
                  const returnPercentage =
                    costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;

                  return (
                    <tr key={index}>
                      <td className="ticker-cell">{holding.ticker}</td>
                      <td>{holding.quantity}</td>
                      <td>{formatCurrency(parseFloat(holding.cost_basis))}</td>
                      <td>
                        {formatCurrency(parseFloat(holding.current_price))}
                      </td>
                      <td>{formatCurrency(holding.market_value)}</td>
                      <td className={`pnl-cell ${getPnlColor(unrealizedPnl)}`}>
                        {formatCurrency(unrealizedPnl)}
                      </td>
                      <td
                        className={`return-cell ${getPnlColor(
                          returnPercentage
                        )}`}
                      >
                        {formatPercentage(returnPercentage)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="no-holdings">
          <h3>No Holdings</h3>
          <p>Start trading to see your profit and loss!</p>
          <p>Cash: {formatCurrency(portfolio?.cash_balance || 0)}</p>
        </div>
      )}
    </div>
  );
}

export default ProfitLoss;
