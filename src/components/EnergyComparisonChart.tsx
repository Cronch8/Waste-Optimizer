import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface EnergyComparisonChartProps {
  data: { time: string; human: number; simulation: number }[];
}

const EnergyComparisonChart: React.FC<EnergyComparisonChartProps> = ({ data }) => {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis  dataKey="time" 
          className="text-xs"
          stroke="hsl(var(--muted-foreground))" />
          <YAxis className="text-xs"
          stroke="hsl(var(--muted-foreground))"
          label={{ value: '€/h', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }} />
           <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            color: 'hsl(var(--foreground))',
          }}
          formatter={(value: number) => [`€${value.toFixed(3)}/h`, 'Price']}
        />
          <Legend wrapperStyle={{ color: "#333" }}/>
          <Line
            type="monotone"
            dataKey="human"
            stroke="#8884d8"
            strokeWidth={2}
            name="Human Electricity Price"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="simulation"
            stroke="#82ca9d"
            strokeWidth={2}
            name="Our AI Simulation"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };
  

export default EnergyComparisonChart;