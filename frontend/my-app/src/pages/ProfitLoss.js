import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import "./ProfitLoss.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
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

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchDailyHistory();
  }, [selectedDays]);

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

  // Create chart data from daily portfolio history (past 30 days)
  const generateDailyChartData = () => {
    if (!dailyHistoryData?.daily_history || dailyHistoryData.daily_history.length === 0) return null;

    const labels = dailyHistoryData.daily_history.map((item) => {
      const date = new Date(item.date);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    });

    const portfolioValues = dailyHistoryData.daily_history.map(
      (item) => item.portfolio_value
    );

    const startValue = portfolioValues[0];
    const endValue = portfolioValues[portfolioValues.length - 1];
    const totalReturn = endValue - startValue;
    const totalReturnPercent = ((totalReturn / startValue) * 100).toFixed(2);

    return {
      labels: labels,
      datasets: [
        {
          label: "Portfolio Value",
          data: portfolioValues,
          borderColor: totalReturn >= 0 ? "#22c55e" : "#ef4444",
          backgroundColor: totalReturn >= 0 ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
      metadata: {
        totalReturn,
        totalReturnPercent,
        startValue,
        endValue,
        days: dailyHistoryData.daily_history.length
      }
    };
  };

  // Create chart data from real transaction history
  const generateChartData = () => {
    if (!historyData?.history || historyData.history.length === 0) return null;

    const labels = historyData.history.map((item) => {
      if (item.date === "Current") {
        return "Current";
      }
      const [year, month, day] = item.date.split("-");
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    });

    const portfolioValues = historyData.history.map(
      (item) => item.portfolio_value
    );

    return {
      labels: labels,
      datasets: [
        {
          label: "Portfolio Value",
          data: portfolioValues,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
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
          // Set minimum to show the range of portfolio values more clearly
          const values = context.chart.data.datasets[0].data;
          const minValue = Math.min(...values);
          return minValue - minValue * 0.01; // Add 1% padding below
        },
        max: function (context) {
          // Set maximum to show the range of portfolio values more clearly
          const values = context.chart.data.datasets[0].data;
          const maxValue = Math.max(...values);
          return maxValue + maxValue * 0.01; // Add 1% padding above
        },
        ticks: {
          callback: function (value) {
            return formatCurrency(value);
          },
        },
        title: {
          display: true,
          text: "Portfolio Value ($)",
        },
      },
      x: {
        display: true,
        title: {
          display: true,
          text: "Date",
        },
        ticks: {
          maxTicksLimit: 8, // Limit the number of date labels to prevent crowding
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
    interaction: {
      intersect: false,
      mode: "index",
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

  const chartData = generateChartData();
  const dailyChartData = generateDailyChartData();

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
          <h3>Unrealized P&L</h3>
          <div
            className={`pnl-value ${getPnlColor(
              pnlData?.total_unrealized_pnl || 0
            )}`}
          >
            {formatCurrency(pnlData?.total_unrealized_pnl || 0)}
          </div>
        </div>

        <div className="summary-card">
          <h3>Realized P&L</h3>
          <div
            className={`pnl-value ${getPnlColor(
              pnlData?.total_realized_pnl || 0
            )}`}
          >
            {formatCurrency(pnlData?.total_realized_pnl || 0)}
          </div>
        </div>

        <div className="summary-card">
          <h3>Portfolio Value</h3>
          <div className="pnl-value">
            {formatCurrency(portfolio?.total_value || 0)}
          </div>
        </div>
      </div>

      {/* 30-Day Portfolio Value Chart */}
      {dailyChartData && (
        <div className="chart-section">
          <div className="chart-header">
            <h3>Portfolio Value - Past {selectedDays} Days</h3>
            <div className="chart-controls">
              <label htmlFor="days-select">Time Period: </label>
              <select
                id="days-select"
                value={selectedDays}
                onChange={(e) => setSelectedDays(parseInt(e.target.value))}
                className="days-dropdown"
              >
                <option value={7}>7 Days</option>
                <option value={15}>15 Days</option>
                <option value={30}>30 Days</option>
                <option value={90}>90 Days</option>
              </select>
            </div>
          </div>
          <div className="chart-container">
            <Line data={dailyChartData} options={chartOptions} />
          </div>
          {dailyChartData.metadata && (
            <div className="chart-info">
              <p>
                <strong>{selectedDays}-Day Performance:</strong>{" "}
                <span className={getPnlColor(dailyChartData.metadata.totalReturn)}>
                  {formatCurrency(dailyChartData.metadata.totalReturn)} 
                  ({dailyChartData.metadata.totalReturnPercent >= 0 ? "+" : ""}{dailyChartData.metadata.totalReturnPercent}%)
                </span>
              </p>
              <p>
                Starting Value: {formatCurrency(dailyChartData.metadata.startValue)} → 
                Current Value: {formatCurrency(dailyChartData.metadata.endValue)}
              </p>
            </div>
          )}
        </div>
      )}

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
                  <th>Ticker</th>
                  <th>Quantity</th>
                  <th>Cost Basis</th>
                  <th>Current Price</th>
                  <th>Market Value</th>
                  <th>Unrealized P&L</th>
                  <th>Return %</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.holdings.map((holding, index) => {
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

      {/* Performance Insights */}
      <div className="performance-insights">
        <h3>Performance Insights</h3>
        <div className="insights-grid">
          <div className="insight-card">
            <h4>Best Performer</h4>
            {portfolio?.holdings && portfolio.holdings.length > 0 ? (
              (() => {
                const bestHolding = portfolio.holdings.reduce(
                  (best, current) => {
                    const currentReturn =
                      parseFloat(current.unrealized_pnl || 0) /
                      (parseFloat(current.cost_basis) *
                        parseFloat(current.quantity));
                    const bestReturn =
                      parseFloat(best.unrealized_pnl || 0) /
                      (parseFloat(best.cost_basis) * parseFloat(best.quantity));
                    return currentReturn > bestReturn ? current : best;
                  }
                );
                const returnPercentage =
                  (parseFloat(bestHolding.unrealized_pnl || 0) /
                    (parseFloat(bestHolding.cost_basis) *
                      parseFloat(bestHolding.quantity))) *
                  100;
                return (
                  <div>
                    <p>
                      <strong>{bestHolding.ticker}</strong>
                    </p>
                    <p className={`${getPnlColor(returnPercentage)}`}>
                      {formatPercentage(returnPercentage)}
                    </p>
                  </div>
                );
              })()
            ) : (
              <p>No holdings yet</p>
            )}
          </div>

          <div className="insight-card">
            <h4>Worst Performer</h4>
            {portfolio?.holdings && portfolio.holdings.length > 0 ? (
              (() => {
                const worstHolding = portfolio.holdings.reduce(
                  (worst, current) => {
                    const currentReturn =
                      parseFloat(current.unrealized_pnl || 0) /
                      (parseFloat(current.cost_basis) *
                        parseFloat(current.quantity));
                    const worstReturn =
                      parseFloat(worst.unrealized_pnl || 0) /
                      (parseFloat(worst.cost_basis) *
                        parseFloat(worst.quantity));
                    return currentReturn < worstReturn ? current : worst;
                  }
                );
                const returnPercentage =
                  (parseFloat(worstHolding.unrealized_pnl || 0) /
                    (parseFloat(worstHolding.cost_basis) *
                      parseFloat(worstHolding.quantity))) *
                  100;
                return (
                  <div>
                    <p>
                      <strong>{worstHolding.ticker}</strong>
                    </p>
                    <p className={`${getPnlColor(returnPercentage)}`}>
                      {formatPercentage(returnPercentage)}
                    </p>
                    <p className="insight-detail">
                      {returnPercentage < 0
                        ? `Down ${Math.abs(returnPercentage).toFixed(
                            2
                          )}% from cost basis`
                        : `Up ${returnPercentage.toFixed(2)}% from cost basis`}
                    </p>
                  </div>
                );
              })()
            ) : (
              <p>No holdings yet</p>
            )}
          </div>

          <div className="insight-card">
            <h4>Portfolio Status</h4>
            <div
              className={`status-indicator ${getPnlColor(calculateTotalPnl())}`}
            >
              {calculateTotalPnl() >= 0 ? "Profitable" : "At Loss"}
            </div>
            <p>
              {calculateTotalPnl() >= 0
                ? "Your portfolio is currently profitable!"
                : "Your portfolio is currently at a loss."}
            </p>
          </div>

          <div className="insight-card">
            <h4>Cash Position</h4>
            <p>
              <strong>{formatCurrency(portfolio?.cash_balance || 0)}</strong>
            </p>
            <p>
              {portfolio?.cash_balance > 0
                ? "You have cash available for new investments."
                : "No cash available for new investments."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfitLoss;
