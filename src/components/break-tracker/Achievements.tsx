import React from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Flame, 
  Star, 
  Crown, 
  Medal, 
  Zap,
  Target,
  Award,
  Sparkles,
  Coffee,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { BreakStats } from '@/hooks/useBreakTracker';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  requirement: number;
  type: 'streak' | 'total' | 'weekly' | 'monthly' | 'rate';
  color: string;
  bgGradient: string;
}

const achievements: Achievement[] = [
  // Streak Achievements
  {
    id: 'streak-3',
    name: 'Guter Start',
    description: '3 Tage Streak erreicht',
    icon: <Flame className="h-6 w-6" />,
    requirement: 3,
    type: 'streak',
    color: 'text-orange-500',
    bgGradient: 'from-orange-500/20 to-amber-500/20'
  },
  {
    id: 'streak-7',
    name: 'Wochenkrieger',
    description: '7 Tage Streak erreicht',
    icon: <Zap className="h-6 w-6" />,
    requirement: 7,
    type: 'streak',
    color: 'text-yellow-500',
    bgGradient: 'from-yellow-500/20 to-orange-500/20'
  },
  {
    id: 'streak-14',
    name: 'Durchhalter',
    description: '14 Tage Streak erreicht',
    icon: <Star className="h-6 w-6" />,
    requirement: 14,
    type: 'streak',
    color: 'text-blue-500',
    bgGradient: 'from-blue-500/20 to-cyan-500/20'
  },
  {
    id: 'streak-30',
    name: 'Monats-Meister',
    description: '30 Tage Streak erreicht',
    icon: <Trophy className="h-6 w-6" />,
    requirement: 30,
    type: 'streak',
    color: 'text-purple-500',
    bgGradient: 'from-purple-500/20 to-pink-500/20'
  },
  {
    id: 'streak-60',
    name: 'Unaufhaltsam',
    description: '60 Tage Streak erreicht',
    icon: <Crown className="h-6 w-6" />,
    requirement: 60,
    type: 'streak',
    color: 'text-amber-500',
    bgGradient: 'from-amber-500/20 to-yellow-500/20'
  },
  {
    id: 'streak-100',
    name: 'Legende',
    description: '100 Tage Streak erreicht',
    icon: <Sparkles className="h-6 w-6" />,
    requirement: 100,
    type: 'streak',
    color: 'text-rose-500',
    bgGradient: 'from-rose-500/20 to-red-500/20'
  },
  // Total Achievements
  {
    id: 'total-10',
    name: 'Erste Schritte',
    description: '10 Pausen insgesamt',
    icon: <Coffee className="h-6 w-6" />,
    requirement: 10,
    type: 'total',
    color: 'text-emerald-500',
    bgGradient: 'from-emerald-500/20 to-green-500/20'
  },
  {
    id: 'total-50',
    name: 'Regelmäßig',
    description: '50 Pausen insgesamt',
    icon: <Target className="h-6 w-6" />,
    requirement: 50,
    type: 'total',
    color: 'text-teal-500',
    bgGradient: 'from-teal-500/20 to-cyan-500/20'
  },
  {
    id: 'total-100',
    name: 'Jahrhundert',
    description: '100 Pausen insgesamt',
    icon: <Medal className="h-6 w-6" />,
    requirement: 100,
    type: 'total',
    color: 'text-indigo-500',
    bgGradient: 'from-indigo-500/20 to-violet-500/20'
  },
  {
    id: 'total-365',
    name: 'Jahressammler',
    description: '365 Pausen insgesamt',
    icon: <Calendar className="h-6 w-6" />,
    requirement: 365,
    type: 'total',
    color: 'text-sky-500',
    bgGradient: 'from-sky-500/20 to-blue-500/20'
  },
  // Rate Achievement
  {
    id: 'rate-80',
    name: 'Konstant',
    description: '80% Erfolgsrate in 30 Tagen',
    icon: <TrendingUp className="h-6 w-6" />,
    requirement: 80,
    type: 'rate',
    color: 'text-green-500',
    bgGradient: 'from-green-500/20 to-emerald-500/20'
  },
  {
    id: 'rate-100',
    name: 'Perfektionist',
    description: '100% Erfolgsrate in 30 Tagen',
    icon: <Award className="h-6 w-6" />,
    requirement: 100,
    type: 'rate',
    color: 'text-fuchsia-500',
    bgGradient: 'from-fuchsia-500/20 to-pink-500/20'
  }
];

interface AchievementsProps {
  stats: BreakStats;
}

export const Achievements: React.FC<AchievementsProps> = ({ stats }) => {
  const getProgress = (achievement: Achievement): number => {
    let current: number;
    switch (achievement.type) {
      case 'streak':
        current = Math.max(stats.currentStreak, stats.longestStreak);
        break;
      case 'total':
        current = stats.totalBreaks;
        break;
      case 'rate':
        current = stats.completionRate;
        break;
      default:
        current = 0;
    }
    return Math.min((current / achievement.requirement) * 100, 100);
  };

  const isUnlocked = (achievement: Achievement): boolean => {
    return getProgress(achievement) >= 100;
  };

  const unlockedCount = achievements.filter(isUnlocked).length;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const item = {
    hidden: { opacity: 0, scale: 0.9 },
    show: { opacity: 1, scale: 1 }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <CardTitle>Achievements</CardTitle>
          </div>
          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
            {unlockedCount}/{achievements.length} freigeschaltet
          </Badge>
        </div>
        <CardDescription>
          Schalte Erfolge durch regelmäßige Pausen frei
        </CardDescription>
      </CardHeader>
      <CardContent>
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3"
        >
          {achievements.map((achievement) => {
            const unlocked = isUnlocked(achievement);
            const progress = getProgress(achievement);
            
            return (
              <motion.div
                key={achievement.id}
                variants={item}
                className={cn(
                  "relative p-3 rounded-xl border transition-all",
                  unlocked 
                    ? `bg-gradient-to-br ${achievement.bgGradient} border-transparent` 
                    : "bg-muted/30 border-border opacity-60"
                )}
              >
                <div className="flex flex-col items-center text-center gap-2">
                  <div className={cn(
                    "p-2.5 rounded-xl",
                    unlocked ? `${achievement.color} bg-white/20` : "text-muted-foreground bg-muted"
                  )}>
                    {achievement.icon}
                  </div>
                  <div>
                    <p className={cn(
                      "font-semibold text-xs",
                      unlocked ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {achievement.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {achievement.description}
                    </p>
                  </div>
                  {!unlocked && (
                    <div className="w-full">
                      <Progress value={progress} className="h-1" />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {Math.round(progress)}%
                      </p>
                    </div>
                  )}
                  {unlocked && (
                    <Badge className={cn("text-[10px] px-1.5 py-0", achievement.color, "bg-white/30")}>
                      ✓ Erreicht
                    </Badge>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </CardContent>
    </Card>
  );
};
