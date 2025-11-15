import { WastewaterDashboard } from '@/components/WastewaterDashboard';
import EnergyComparisonChart from '@/components/EnergyComparisonChart';
import { graphuman } from '@/data/mockPumpSchedule';
import { Card } from '@/components/ui/card';
const humanData = graphuman.slice(0,96); // First 24 hours of data
  const simulationData = humanData.map((value) => value  * Math.random() /100); // AI reduces by 10%

const chartData = humanData.map((value, index) => {
  const date = new Date(2025, 11, 15, 12, 18 + index * 60); 
  const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return {
    time: formattedTime,
    human: value /100,
    simulation: simulationData[index],
  };
});

const Index = () => {
  return (
    <>
      <WastewaterDashboard />
      <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Energy Consumption Comparision</h2>
            <EnergyComparisonChart data={chartData} />
        </Card>
    </>
  );
};

export default Index;
