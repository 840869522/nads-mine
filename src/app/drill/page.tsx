"use client";
import React, { useState, useEffect } from 'react';
import { DroneNode, Team, TeamColor, AttackLogEntry, User, UserRole } from '@/types';
import { INITIAL_DRONE_NODES, TEAM_COLOR_TRANSLATIONS } from '@/constants'; 
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import TeamSetup from '@/components/attackdefense/TeamSetup';
import AttackLogFeed from '@/components/attackdefense/AttackLogFeed';
import NodeCard from '@/components/scenario/NodeCard'; 
import { ShieldCheckIcon, FireIcon, FlagIcon, UsersIcon, CogIcon } from '@heroicons/react/24/outline';

const mockUsers: User[] = [
    { id: 'user1', username: '攻击者一号', role: UserRole.ATTACKER },
    { id: 'user2', username: '防御者阿尔法', role: UserRole.DEFENDER },
    { id: 'user3', username: '红队队长', role: UserRole.ATTACKER },
    { id: 'user4', username: '蓝队守卫', role: UserRole.DEFENDER },
];


const AttackDefensePage: React.FC = () => {
  const [nodes, setNodes] = useState<DroneNode[]>(INITIAL_DRONE_NODES.map(n => ({...n, status: 'online'})));
  const [redTeam, setRedTeam] = useState<Team>({ color: TeamColor.RED, members: [], nodes: [] });
  const [blueTeam, setBlueTeam] = useState<Team>({ color: TeamColor.BLUE, members: [], nodes: [] });
  const [attackLogs, setAttackLogs] = useState<AttackLogEntry[]>([]);
  const [drillActive, setDrillActive] = useState<boolean>(false);
  const [drillStage, setDrillStage] = useState<'setup' | 'running' | 'finished'>('setup');

  const assignNodesToTeams = () => {
    const availableNodes = [...nodes];
    const redTeamNodes: DroneNode[] = [];
    const blueTeamNodes: DroneNode[] = [];

    availableNodes.forEach((node, index) => {
        if (index % 2 === 0 && blueTeamNodes.length < Math.ceil(availableNodes.length / 2)) {
            blueTeamNodes.push({...node, assignedTeam: TeamColor.BLUE});
        } else if (redTeamNodes.length < Math.floor(availableNodes.length / 2)) {
            redTeamNodes.push({...node, assignedTeam: TeamColor.RED});
        } else { 
            blueTeamNodes.push({...node, assignedTeam: TeamColor.BLUE});
        }
    });

    setBlueTeam(prev => ({ ...prev, nodes: blueTeamNodes, members: mockUsers.filter(u => u.role === UserRole.DEFENDER) }));
    setRedTeam(prev => ({ ...prev, nodes: redTeamNodes, members: mockUsers.filter(u => u.role === UserRole.ATTACKER) }));
    
    setNodes(prevNodes => prevNodes.map(n => {
        const blueNode = blueTeamNodes.find(bn => bn.id === n.id);
        if (blueNode) return blueNode;
        const redNode = redTeamNodes.find(rn => rn.id === n.id);
        if (redNode) return redNode;
        return n;
    }));
  };
  
  useEffect(() => {
    if (drillStage === 'setup') {
        assignNodesToTeams();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillStage]);


  const startDrill = () => {
    if (redTeam.nodes.length === 0 && blueTeam.nodes.length === 0) {
        alert("开始演练前请为队伍分配节点。");
        assignNodesToTeams(); 
    }
    setDrillActive(true);
    setDrillStage('running');
    addLog(TeamColor.RED, "演练开始。红队正在部署资产。", "system");
    addLog(TeamColor.BLUE, "演练开始。蓝队高度戒备。", "system");
  };

  const stopDrill = () => {
    setDrillActive(false);
    setDrillStage('finished');
    addLog(TeamColor.RED, "演练结束。", "system", "success");
    addLog(TeamColor.BLUE, "演练结束。", "system", "success");
  };

  const addLog = (team: TeamColor, action: string, target?: string, result?: 'success' | 'failure') => {
    setAttackLogs(prev => [...prev, { id: Date.now().toString(), timestamp: new Date(), team, action, target, result }]);
  };

  const simulateAttack = (nodeId: string) => {
    if (!drillActive) return;
    const targetNode = nodes.find(n => n.id === nodeId);
    if (targetNode && targetNode.assignedTeam === TeamColor.BLUE && targetNode.status === 'online') {
      addLog(TeamColor.RED, `正在对 ${targetNode.name} (${nodeId}) 进行侦察扫描`);
      setTimeout(() => {
        const success = Math.random() > 0.4;
        if (success) {
          addLog(TeamColor.RED, `成功入侵 ${targetNode.name}！`, nodeId, 'success');
          setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, status: 'compromised' } : n));
        } else {
          addLog(TeamColor.RED, `对 ${targetNode.name} 的攻击被检测到并失败。`, nodeId, 'failure');
          addLog(TeamColor.BLUE, `检测到对 ${targetNode.name} 的入侵尝试。正在缓解。`, nodeId, 'success');
        }
      }, 2000 + Math.random() * 2000);
    } else if (targetNode && targetNode.status !== 'online') {
         addLog(TeamColor.RED, `目标 ${targetNode.name} 已离线。攻击中止。`, nodeId, 'failure');
    }
  };
  
  const simulateDefense = (nodeId: string) => {
    if (!drillActive) return;
    const targetNode = nodes.find(n => n.id === nodeId);
    if (targetNode && targetNode.assignedTeam === TeamColor.BLUE && targetNode.status === 'compromised') {
      addLog(TeamColor.BLUE, `尝试恢复并保护 ${targetNode.name} (${nodeId})`);
      setTimeout(() => {
        addLog(TeamColor.BLUE, `${targetNode.name} 已保护并恢复在线。`, nodeId, 'success');
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, status: 'online' } : n));
      }, 1500 + Math.random() * 1500);
    }
  };

  const resetDrill = () => {
    setNodes(INITIAL_DRONE_NODES.map(n => ({...n, status: 'online'})));
    setRedTeam({ color: TeamColor.RED, members: [], nodes: [] });
    setBlueTeam({ color: TeamColor.BLUE, members: [], nodes: [] });
    setAttackLogs([]);
    setDrillActive(false);
    setDrillStage('setup');
    assignNodesToTeams();
  };

  const redTeamTargetableNodes = nodes.filter(n => n.assignedTeam === TeamColor.BLUE && n.status === 'online');
  const blueTeamDefendableNodes = nodes.filter(n => n.assignedTeam === TeamColor.BLUE && n.status === 'compromised');

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100">攻防演练</h1>
        <div className="flex space-x-2">
            {drillStage === 'setup' && <Button onClick={startDrill} leftIcon={<FlagIcon className="h-5 w-5"/>} variant="primary">开始演练</Button>}
            {drillStage === 'running' && <Button onClick={stopDrill} leftIcon={<CogIcon className="h-5 w-5"/>} variant="danger">停止演练</Button>}
            {drillStage === 'finished' && <Button onClick={resetDrill} leftIcon={<CogIcon className="h-5 w-5"/>} variant="secondary">重置演练</Button>}
        </div>
      </div>

      {drillStage === 'setup' && (
        <Card title="演练设置" icon={<UsersIcon className="h-6 w-6 mr-2"/>} className="mb-6">
          <p className="mb-4 text-neutral-600 dark:text-neutral-300">此演示的团队和节点是自动分配的。在完整版本中，您将在此处手动分配用户和节点。</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TeamSetup team={redTeam} users={mockUsers.filter(u=>u.role === UserRole.ATTACKER)} availableNodes={nodes} onUpdateTeam={setRedTeam} />
            <TeamSetup team={blueTeam} users={mockUsers.filter(u=>u.role === UserRole.DEFENDER)} availableNodes={nodes} onUpdateTeam={setBlueTeam} />
          </div>
        </Card>
      )}

    {(drillStage === 'running' || drillStage === 'finished') && (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card title="红队操作" icon={<FireIcon className="h-6 w-6 mr-2 text-red-500"/>}>
                <p className="text-sm mb-2 text-neutral-600 dark:text-neutral-400">目标蓝队节点：</p>
                {redTeamTargetableNodes.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto p-1">
                    {redTeamTargetableNodes.map(node => (
                        <Button key={node.id} variant="danger" size="sm" className="w-full justify-start" onClick={() => simulateAttack(node.id)} disabled={!drillActive}>
                          {`攻击 ${node.name}`}
                        </Button>
                    ))}
                    </div>
                ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">没有可攻击的在线蓝队节点。</p>}
                 <p className="text-xs mt-2 text-neutral-500 dark:text-neutral-400">
                  {`成员 (${redTeam.members.length}):`} {redTeam.members.map(m=>m.username).join(', ') || "未分配成员。"}
                 </p>
            </Card>

            <Card title="蓝队操作" icon={<ShieldCheckIcon className="h-6 w-6 mr-2 text-blue-500"/>}>
                <p className="text-sm mb-2 text-neutral-600 dark:text-neutral-400">防御受损节点：</p>
                {blueTeamDefendableNodes.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto p-1">
                    {blueTeamDefendableNodes.map(node => (
                        <Button key={node.id} variant="primary" size="sm" className="w-full justify-start" onClick={() => simulateDefense(node.id)} disabled={!drillActive}>
                          {`保护 ${node.name}`}
                        </Button>
                    ))}
                    </div>
                ): <p className="text-sm text-neutral-500 dark:text-neutral-400">没有受损节点可以防御。</p>}
                 <p className="text-xs mt-2 text-neutral-500 dark:text-neutral-400">
                   {`成员 (${blueTeam.members.length}):`} {blueTeam.members.map(m=>m.username).join(', ') || "未分配成员。"}
                 </p>
            </Card>
        </div>
        
        <h2 className="text-xl font-semibold mb-2 mt-8 text-neutral-700 dark:text-neutral-200">节点状态概览</h2>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {nodes.map(node => (
              <NodeCard key={node.id} node={node} onToggleStatus={() => { /* Toggle status not available here */}} />
            ))}
        </div>

        <AttackLogFeed logs={attackLogs} />

        {drillStage === 'finished' && (
            <Card title="演练结果" className="mt-8">
                <p className="font-semibold text-lg">总结：</p>
                <p>{`红队得分: ${nodes.filter(n => n.assignedTeam === TeamColor.BLUE && n.status === 'compromised').length} 个节点被入侵。`}</p>
                <p>{`蓝队得分: ${nodes.filter(n => n.assignedTeam === TeamColor.BLUE && n.status === 'online').length} 个节点已保护。`}</p>
            </Card>
        )}
      </>
    )}
    </div>
  );
};

export default AttackDefensePage;
