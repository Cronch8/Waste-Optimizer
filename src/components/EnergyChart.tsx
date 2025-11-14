import { ElectricityPrice } from '@/types/wastewater';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface EnergyChartProps {
  prices: ElectricityPrice[];
  energyUsage: number;
}

export const EnergyChart = ({ prices, energyUsage }: EnergyChartProps) => {
  const data = prices.map((p) => ({
    time: format(p.timestamp, 'HH:mm'),
    cost: Number((energyUsage * p.price).toFixed(2)),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis 
          dataKey="time" 
          className="text-xs"
          stroke="hsl(var(--muted-foreground))"
        />
        <YAxis 
          className="text-xs"
          stroke="hsl(var(--muted-foreground))"
          label={{ value: '€/hour', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            color: 'hsl(var(--foreground))',
          }}
          formatter={(value: number) => [`€${value.toFixed(2)}/h`, 'Cost']}
        />
        <Line
          type="monotone"
          dataKey="cost"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
