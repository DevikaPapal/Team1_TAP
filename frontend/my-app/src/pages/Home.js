import React, { useState, useEffect } from "react";
import { Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import "./Home.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  ArcElement
);

function Home() {
  const [portfolio, setPortfolio] = useState(null);
  const [pnlData, setPnlData] = useState(null);
  const [dailyHistoryData, setDailyHistoryData] = useState(null);
  const [selectedDays, setSelectedDays] = useState(7);
  const [marketIndices, setMarketIndices] = useState(null);
  const [sectorBreakdown, setSectorBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchDailyHistory();
  }, [selectedDays]);

  // Auto-refresh market indices every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMarketIndices();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchMarketIndices = async () => {
    try {
      const response = await fetch("http://localhost:5001/market-indices");
      if (response.ok) {
        const data = await response.json();
        setMarketIndices(data);
      }
    } catch (err) {
      console.log("Failed to fetch market indices:", err.message);
    }
  };

  const fetchSectorBreakdown = async () => {
    try {
      const response = await fetch(
        "http://localhost:5001/portfolio/sector-breakdown"
      );
      if (response.ok) {
        const data = await response.json();
        setSectorBreakdown(data);
      }
    } catch (err) {
      console.log("Failed to fetch sector breakdown:", err.message);
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

      // Fetch market indices and sector breakdown
      await fetchMarketIndices();
      await fetchSectorBreakdown();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setupPortfolio = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5001/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error("Failed to setup portfolio");
      }
      // After setup, fetch the portfolio data
      await fetchData();
    } catch (err) {
      setError(err.message);
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

  // Create chart data from daily portfolio history
  const generateDailyChartData = () => {
    if (
      !dailyHistoryData?.daily_history ||
      dailyHistoryData.daily_history.length === 0
    )
      return null;

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

    // Add today's portfolio value if we have current portfolio data
    if (portfolio?.total_value) {
      const today = new Date();
      const todayLabel = today.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      // Only add today if it's not already the last data point
      const lastLabel = labels[labels.length - 1];
      if (lastLabel !== todayLabel) {
        labels.push(todayLabel);
        portfolioValues.push(portfolio.total_value);
      } else {
        // Update the last value if it's already today
        portfolioValues[portfolioValues.length - 1] = portfolio.total_value;
      }
    }

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
        days: dailyHistoryData.daily_history.length,
      },
    };
  };

  // Create pie chart data for sector breakdown
  const generateSectorPieData = () => {
    if (!sectorBreakdown?.sectors || sectorBreakdown.sectors.length === 0)
      return null;

    const colors = [
      "#3B82F6",
      "#EF4444",
      "#10B981",
      "#F59E0B",
      "#8B5CF6",
      "#06B6D4",
      "#84CC16",
      "#F97316",
      "#EC4899",
      "#6366F1",
    ];

    return {
      labels: sectorBreakdown.sectors.map((sector) => sector.sector),
      datasets: [
        {
          data: sectorBreakdown.sectors.map((sector) => sector.percentage),
          backgroundColor: colors.slice(0, sectorBreakdown.sectors.length),
          borderWidth: 2,
          borderColor: "#ffffff",
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
          maxTicksLimit: 8,
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

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 20,
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return `${context.label}: ${context.parsed}%`;
          },
        },
      },
    },
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
        <button onClick={fetchData}>Retry</button>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="error-container">
        <h2>No Portfolio Data</h2>
      </div>
    );
  }

  const dailyChartData = generateDailyChartData();
  const sectorPieData = generateSectorPieData();

  return (
    <div className="home-container">
      {/* Left Side - Main Content (75%) */}
      <div className="main-content">
        {/* Portfolio Summary Cards */}
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

          <div className="summary-card">
            <h3>Cash Balance</h3>
            <div className="pnl-value">
              {formatCurrency(portfolio?.cash_balance || 0)}
            </div>
          </div>
        </div>

        {/* Portfolio Value Chart */}
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
                  <span
                    className={getPnlColor(dailyChartData.metadata.totalReturn)}
                  >
                    {formatCurrency(dailyChartData.metadata.totalReturn)}(
                    {dailyChartData.metadata.totalReturnPercent >= 0 ? "+" : ""}
                    {dailyChartData.metadata.totalReturnPercent}%)
                  </span>
                </p>
                <p>
                  Starting Value:{" "}
                  {formatCurrency(dailyChartData.metadata.startValue)} → Current
                  Value: {formatCurrency(dailyChartData.metadata.endValue)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Holdings Table */}
        <div className="holdings-section">
          <h3>Holdings ({portfolio?.holdings?.length || 0})</h3>
          <div className="holdings-table-container">
            {portfolio.holdings.length === 0 ? (
              <div className="no-holdings">
                <p>No holdings yet. Start trading to see your portfolio!</p>
              </div>
            ) : (
              <table className="holdings-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Quantity</th>
                    <th>Cost Basis</th>
                    <th>Current Price</th>
                    <th>Market Value</th>
                    <th>Unrealized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.holdings.map((holding, index) => (
                    <tr
                      key={index}
                      className={
                        index % 2 === 0 ? "table-row-even" : "table-row-odd"
                      }
                    >
                      <td className="ticker-cell">{holding.ticker}</td>
                      <td>{holding.quantity}</td>
                      <td>{formatCurrency(parseFloat(holding.cost_basis))}</td>
                      <td>
                        {formatCurrency(parseFloat(holding.current_price))}
                      </td>
                      <td>{formatCurrency(holding.market_value)}</td>
                      <td
                        className={`pnl-cell ${getPnlColor(
                          holding.unrealized_pnl
                        )}`}
                      >
                        {formatCurrency(holding.unrealized_pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Setup Button */}
        <div className="setup-section">
          <button onClick={setupPortfolio} className="setup-button">
            Reset & Setup Default Portfolio
          </button>
        </div>
      </div>

      {/* Right Side - Sidebar (25%) */}
      <div className="sidebar">
        {/* Market Indices */}
        <div className="market-indices-section">
          <h3>Market Indices</h3>
          {marketIndices?.indices ? (
            <div className="indices-list">
              {marketIndices.indices.map((index, idx) => (
                <div key={idx} className="index-item">
                  <div className="index-name">{index.name}</div>
                  <div className="index-value">
                    {index.value.toLocaleString()}
                  </div>
                  <div className={`index-change ${getPnlColor(index.change)}`}>
                    {index.change >= 0 ? "+" : ""}
                    {index.change.toFixed(2)} (
                    {index.percent_change >= 0 ? "+" : ""}
                    {index.percent_change.toFixed(2)}%)
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="loading-indices">Loading market data...</div>
          )}
        </div>

        {/* Sector Breakdown Pie Chart */}
        <div className="sector-breakdown-section">
          <h3>Sector Breakdown</h3>
          {sectorPieData ? (
            <div className="pie-chart-container">
              <Pie data={sectorPieData} options={pieChartOptions} />
            </div>
          ) : (
            <div className="no-sectors">
              <p>No sector data available</p>
            </div>
          )}
        </div>

        {/* Performance Insights */}
        <div className="performance-insights-sidebar">
          <h3>Performance Insights</h3>
          <div className="insights-list">
            <div className="insight-item">
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
                        (parseFloat(best.cost_basis) *
                          parseFloat(best.quantity));
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

            <div className="insight-item">
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
                    </div>
                  );
                })()
              ) : (
                <p>No holdings yet</p>
              )}
            </div>

            <div className="insight-item">
              <h4>Portfolio Status</h4>
              <div
                className={`status-indicator ${getPnlColor(
                  calculateTotalPnl()
                )}`}
              >
                {calculateTotalPnl() >= 0 ? "Profitable" : "At Loss"}
              </div>
              <p>
                {calculateTotalPnl() >= 0
                  ? "Your portfolio is currently profitable!"
                  : "Your portfolio is currently at a loss."}
              </p>
            </div>

            <div className="insight-item">
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
    </div>
  );
}

export default Home;
