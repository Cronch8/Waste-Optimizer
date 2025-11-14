import { ElectricityPrice } from '@/types/wastewater';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface ElectricityPriceChartProps {
  prices: ElectricityPrice[];
}

export const ElectricityPriceChart = ({ prices }: ElectricityPriceChartProps) => {
  const data = prices.map((p) => ({
    time: format(p.timestamp, 'HH:mm'),
    price: Number(p.price.toFixed(3)),
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
          label={{ value: '€/kWh', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            color: 'hsl(var(--foreground))',
          }}
          formatter={(value: number) => [`€${value.toFixed(3)}/kWh`, 'Price']}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke="#06b6d4"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
