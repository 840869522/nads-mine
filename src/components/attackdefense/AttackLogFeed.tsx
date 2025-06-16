import React from 'react';
import { AttackLogEntry, TeamColor } from '../../types';
import Card from '../ui/Card';
import { ShieldCheckIcon, FireIcon, CheckCircleIcon, XCircleIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import { TEAM_COLOR_TRANSLATIONS } from '../../constants';

interface AttackLogFeedProps {
  logs: AttackLogEntry[];
}

const AttackLogFeed: React.FC<AttackLogFeedProps> = ({ logs }) => {

  const getLogIcon = (log: AttackLogEntry) => {
    if (log.result === 'success') return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    if (log.result === 'failure') return <XCircleIcon className="h-5 w-5 text-red-500" />;
    if (log.team === TeamColor.RED) return <FireIcon className="h-5 w-5 text-red-400" />;
    if (log.team === TeamColor.BLUE) return <ShieldCheckIcon className="h-5 w-5 text-blue-400" />;
    return <InformationCircleIcon className="h-5 w-5 text-neutral-400" />;
  };

  const getTeamColorClass = (team: TeamColor) => {
    return team === TeamColor.RED ? 'text-red-500 dark:text-red-400' : 'text-blue-500 dark:text-blue-400';
  };

  return (
    <Card title="实时事件日志" className="max-h-[500px] flex flex-col">
      {logs.length === 0 ? (
         <div className="p-4 text-center text-neutral-500 dark:text-neutral-400">暂无事件。开始演练以查看实时更新。</div>
      ) : (
        <div className="overflow-y-auto flex-grow p-1">
          {logs.slice().reverse().map(log => {
            const teamName = TEAM_COLOR_TRANSLATIONS[log.team];
            return (
              <div key={log.id} className="p-3 mb-2 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors duration-150 rounded">
                <div className="flex items-start space-x-3">
                  <span className="flex-shrink-0 mt-0.5">{getLogIcon(log)}</span>
                  <div className="flex-grow">
                    <p className="text-sm">
                      <span className={`font-semibold ${getTeamColorClass(log.team)}`}>
                        {`${teamName}队: `}
                      </span>
                      <span className="text-neutral-700 dark:text-neutral-200">{log.action}</span>
                      {log.target && log.target !== "system" && <span className="text-neutral-500 dark:text-neutral-400">{` (目标: ${log.target})`}</span>}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default AttackLogFeed;