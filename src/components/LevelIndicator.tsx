import { AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface LevelIndicatorProps {
  level: number;
  label: string;
  maxCapacity: number;
  inflow?: number;
  outflow?: number;
  type: 'tunnel' | 'tank';
}

export const LevelIndicator = ({
  level,
  label,
  maxCapacity,
  inflow,
  outflow,
  type,
}: LevelIndicatorProps) => {
  const isWarning = level > 85;
  const isCritical = level > 95;
  
  const currentVolume = (level / 100) * maxCapacity;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {(isWarning || isCritical) && (
          <AlertTriangle className={isCritical ? 'w-5 h-5 text-destructive' : 'w-5 h-5 text-yellow-500'} />
        )}
      </div>
      
      <div className="space-y-2">
        <div className="text-4xl font-bold text-foreground">
          {Math.round(level)}%
        </div>
        <Progress 
          value={level} 
          className="h-4"
          indicatorClassName={
            isCritical 
              ? 'bg-destructive' 
              : isWarning 
              ? 'bg-yellow-500' 
              : 'bg-cyan-500'
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2">
        <div>
          <div className="text-xs text-muted-foreground">Volume</div>
          <div className="text-lg font-semibold text-foreground">{Math.round(currentVolume)} m³</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Capacity</div>
          <div className="text-lg font-semibold text-foreground">{maxCapacity} m³</div>
        </div>
      </div>
    </div>
  );
};
