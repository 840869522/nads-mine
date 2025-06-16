import React from 'react';
import { Team, User, DroneNode, TeamColor } from '../../types';
import Card from '../ui/Card';
import { UserGroupIcon } from '@heroicons/react/24/solid';
import { TEAM_COLOR_TRANSLATIONS } from '../../constants';

interface TeamSetupProps {
  team: Team;
  users: User[]; 
  availableNodes: DroneNode[];
  onUpdateTeam: (updatedTeam: Team) => void; 
}

const TeamSetup: React.FC<TeamSetupProps> = ({ team, users, availableNodes }) => {
  const teamColorClass = team.color === TeamColor.RED ? 'border-red-500' : 'border-blue-500';
  const teamTextClass = team.color === TeamColor.RED ? 'text-red-500' : 'text-blue-500';
  const teamName = TEAM_COLOR_TRANSLATIONS[team.color];

  return (
    <Card className={`border-2 ${teamColorClass}`}>
      <h3 className={`text-xl font-bold mb-4 ${teamTextClass} flex items-center`}>
        {team.color === TeamColor.RED ? <UserGroupIcon className="h-6 w-6 mr-2 text-red-500"/> : <UserGroupIcon className="h-6 w-6 mr-2 text-blue-500"/>}
        {teamName} 队
      </h3>
      
      <div className="mb-4">
        <h4 className="font-semibold text-neutral-700 dark:text-neutral-200">{`成员 (${team.members.length}):`}</h4>
        {team.members.length > 0 ? (
          <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-300">
            {team.members.map(member => <li key={member.id}>{member.username}</li>)}
          </ul>
        ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">未分配成员。</p>}
      </div>

      <div>
        <h4 className="font-semibold text-neutral-700 dark:text-neutral-200">{`已分配节点 (${team.nodes.length}):`}</h4>
         {team.nodes.length > 0 ? (
            <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-300">
                {team.nodes.map(node => <li key={node.id}>{node.name} ({node.ipAddress})</li>)}
            </ul>
         ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">未分配节点。</p>}
      </div>
    </Card>
  );
};

export default TeamSetup;