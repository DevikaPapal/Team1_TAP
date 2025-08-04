import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

function PortfolioLineChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5001/api/portfolio/daily-values')
      .then(res => res.json())
      .then(setData);
  }, []);

  const chartData = {
    labels: data.map(d => d.date),
    datasets: [
      {
        label: 'Portfolio Value',
        data: data.map(d => d.value),
        borderColor: 'blue',
        fill: false,
      },
    ],
  };

  return <Line data={chartData} />;
}

export default PortfolioLineChart;