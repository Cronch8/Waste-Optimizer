import { SystemState } from '@/types/wastewater';
import { Card } from '@/components/ui/card';
import { Zap, Activity, DollarSign, Brain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SystemStatsProps {
  systemState: SystemState;
}

export const SystemStats = ({ systemState }: SystemStatsProps) => {
  const activePumps = systemState.pumps.filter(p => p.active).length;
  const currentPrice = systemState.electricityPrices[systemState.electricityPrices.length - 1]?.price || 0;

  const getStatusColor = () => {
    switch (systemState.aiStatus) {
      case 'stable':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'optimizing':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Active Pumps</div>
            <div className="text-2xl font-bold text-foreground">{activePumps}/10</div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Energy</div>
            <div className="text-2xl font-bold text-foreground">{systemState.totalEnergyUsage} kW</div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Current Cost</div>
            <div className="text-2xl font-bold text-foreground">€{systemState.currentCost.toFixed(2)}/h</div>
            <div className="text-xs text-muted-foreground mt-1">
              Price: €{currentPrice.toFixed(3)}/kWh
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground mb-2">AI Status</div>
            <Badge className={getStatusColor()}>
              {systemState.aiStatus === 'stable' && 'Stable'}
              {systemState.aiStatus === 'optimizing' && 'Optimizing...'}
              {systemState.aiStatus === 'warning' && 'Warning'}
            </Badge>
          </div>
        </div>
      </Card>
    </>
  );
};
