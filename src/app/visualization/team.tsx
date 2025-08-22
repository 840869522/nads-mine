import {useEffect, useState} from "react";
import styles from "../../styles/main/team.module.css"
import { websocketClient } from "@/utils/websocket";

export type TeamInfo = {
    teamId: number;
    teamName: string;
    teamScore: number;
};

export type LogInfo ={
    logId: number;
    logTime: string;
    logContent: string;
}

export type BattlefieldInfo = {
    type: number;
    teamInfo: TeamInfo[];
    logInfo: LogInfo[];
};

function TeamInfoItem(props: TeamInfo) {
    return (
        <div className="flex h-[30px] justify-between items-center">
            <div className="flex-1 text-center">
                <div className="text-[#ffcc00] font-bold">{props.teamId}</div>
            </div>
            <div className="flex-1 text-center">
                <div className="bg-[rgba(0,60,120,0.6)]
                    border border-[rgba(0,150,255,0.4)]
                    rounded px-2 py-1
                    text-[0.85rem] text-center">{props.teamName}
                </div>
            </div>
            <div className="flex-1 text-center">
                <div className="text-[#ffcc00] font-bold">{props.teamScore}</div>
            </div>
        </div>
    )
}

function LogItem(props: LogInfo){
    return (
        <li className="flex gap-[10px] px-2 py-[7px] border-b border-b-[rgba(255,255,255,0.05)] text-[0.8rem]">
            <span className="text-[#ffcc00] min-w-[60px] font-mono text-xs">{props.logTime}</span>
            <span className="flex-1 text-[0.8rem]">{props.logContent}</span>
        </li>
    );
}

function TeamInfo(props: {teamList: TeamInfo[]}){
    return(
        <div className="bg-[rgba(245,247,248,0.6)] border border-[rgba(0,150,255,0.3)] rounded-md p-3 mb-3">
            <div className="flex justify-between pb-2 border-b border-b-[rgba(255,255,255,0.1)]">
                <div className="flex-1 text-center h-[20px] text-[#7dd3fc] font-medium text-[0.9rem]">排名</div>
                <div className="flex-1 text-center h-[20px] text-[#7dd3fc] font-medium text-[0.9rem]">席位名称</div>
                <div className="flex-1 text-center h-[20px] text-[#7dd3fc] font-medium text-[0.9rem]">总分</div>
            </div>
            <div className="flex flex-col gap-2 pt-2">
                {props.teamList.map((teamInfo) => (
                    <TeamInfoItem key={teamInfo.teamId} {...teamInfo} />
                ))}
            </div>
        </div>
    );
}

function LogInfo(props: {logList: LogInfo[]}){
    return(
        <div className="h-[60%]
            bg-[rgba(0,10,30,0.6)]
            border border-[rgba(0,150,255,0.3)]
            bottom-[10px] overflow-y-visible
            relative">
            <div className="text-base mb-2 text-[#7dd3fc] h-[20px] flex items-center gap-[6px]">
                {/* <FontAwesomeIcon icon={faClipboardList}/> 过程日志 */}
            </div>
            <ul className="list-none overflow-y-auto h-[calc(100%-30px)] pr-[5px] mb-2.5" id="blue-log">
                {props.logList.slice().reverse().map((logInfo) => (
                    <LogItem key={logInfo.logId} {...logInfo} />
                ))}
            </ul>
        </div>
    );
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export default function Team(team:BattlefieldInfo) {
    const [teamList, setTeamList] = useState<TeamInfo[]>(team.teamInfo)

    const [logList, setLogList] = useState<LogInfo[]>(team.logInfo)

    // 同步父组件更新
    useEffect(() => {
        setTeamList(team.teamInfo)
        setLogList(team.logInfo)
    }, [team])
    if(team.type === 0){
        return (
            <div className="absolute min-w-[300px] grid grid-rows-[auto_auto_1fr]
                    z-[999] top-[20px] bottom-[80px] left-[20px]">
                <div className="flex items-center gap-0 px-3 py-2.5 rounded-md mb-3 h-[40px] bg-gray-800">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(51,102,255,0.8)] text-[#aaccff] text-[1.3rem]">
                        {/* <FontAwesomeIcon icon={faShieldAlt}/> */}
                    </div>
                    <h2 className="text-[1.3rem] font-bold uppercase text-white">蓝方队伍</h2>
                </div>

                <TeamInfo teamList={teamList} />

                <LogInfo logList={logList} />
            </div>
        );
    }else {
        return (
            <div className="absolute min-w-[300px] grid grid-rows-[auto_auto_1fr]
                    z-[999] top-[20px] bottom-[80px] right-[20px]">
                <div className="flex items-center gap-0 px-3 py-2.5 rounded-md mb-3 h-[40px] bg-gray-800">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(51,102,255,0.8)] text-[#aaccff] text-[1.3rem]">
                        {/* <FontAwesomeIcon icon={faCrosshairs}/> */}
                    </div>
                    <h2 className="text-[1.3rem] font-bold uppercase text-white">红方队伍</h2>
                </div>

                <TeamInfo teamList={teamList} />
                <LogInfo logList={logList} />
            </div>
        );
    }
}