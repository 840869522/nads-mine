import {useEffect, useState} from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClipboardList, faShieldAlt, faCrosshairs, faCrown } from '@fortawesome/free-solid-svg-icons'
import { BattlefieldInfo, LogInfo, TeamInfo } from "./team";

const CrownIcon = ({ rank }: { rank: number }) => {
    let crownColorClass = 'text-gray-900';
    let textColorClass = 'text-white';

    if (rank === 0) {
        crownColorClass = 'text-yellow-400';
        textColorClass = 'text-white';
    } else if (rank === 1) {
        crownColorClass = 'text-gray-400';
        textColorClass = 'text-white';
    } else if (rank === 2) {
        crownColorClass = 'text-amber-700';
        textColorClass = 'text-white';
    }

    return (
        <div className="relative flex items-center justify-center w-5 h-5">
            <FontAwesomeIcon icon={faCrown} className={`w-5 h-5 ${crownColorClass}`} />
            <div
                className={`absolute inset-0 flex items-center justify-center font-bold ${textColorClass}`}
                style={{ fontSize: '0.6rem' }} // 使用 style 属性精确设置字号
            >
                {rank+1}
            </div>
        </div>
    );
};

function TeamInfoItem(props: { info: TeamInfo; index: number }) {
    return (
        <div className="flex items-center justify-between py-1 px-4 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
            <div className="flex items-center space-x-2">
                <CrownIcon rank={props.index} />
                <span className="font-medium text-sm text-white">{props.info.teamName}</span>
            </div>
            <span className="text-base font-bold text-yellow-300">{props.info.teamScore}</span>
        </div>
    )
}

function LogItem(props: LogInfo){
    return (
        <div
            className="
        relative
        w-[300px] min-h-[80px]
        flex flex-col justify-center
        text-white font-sans
        pr-8 pl-4 py-4
        mb-4 /* 关键改动：添加底部外边距 */

        /* 核心：使用 clip-path 创建梯形背景 */
        bg-gradient-to-r
        from-[#001f3f99]
        to-[#004d8099]
        border-l-2
        border-l-[#00c6ff]
        shadow-[0_0_10px_rgba(0,198,255,0.5)]

        /* 关键: 精确裁剪出梯形 */
        [clip-path:polygon(0_0,calc(100%-25px)_0,100%_100%,0_100%)]
        "
        >
            <div className="relative z-20 flex flex-col gap-1">
                <p className="text-base opacity-90">
                    事件时间: <span>{props.logTime}</span>
                </p>
                <p className="text-sm opacity-70">
                    信息:<span>{props.logContent}</span>
                </p>
            </div>
        </div>
    );
}

function TeamList(props: {teamList: TeamInfo[]}){
    return(
        <div className="mb-3">
            <div className="flex flex-col gap-2 pt-2">
                {props.teamList.map((teamInfo, index) => (
                    <TeamInfoItem key={teamInfo.teamId} info={teamInfo} index={index} />
                ))}
            </div>
        </div>
    );
}

function LogList(props: {logList: LogInfo[]}){
    return(
        <div className="h-[40vh]
            bg-[rgba(0,10,30,0.6)]
            border border-[rgba(0,150,255,0.3)]
            bottom-[10px] overflow-y-visible
            relative">
            <div className="text-base mb-2 text-[#7dd3fc] h-[20px] flex items-center gap-[6px]">
                <FontAwesomeIcon className="w-4 h-4 text-[#7dd3fc]" icon={faClipboardList}/> 过程日志
            </div>
            <ul className="list-none overflow-y-auto h-[calc(100%-30px)] pr-[5px] mb-2.5 text-white" 
                id="blue-log"
                style={{
                    msOverflowStyle: "none",  // IE/Edge
                    scrollbarWidth: "none",   // Firefox
                }}>
                {props.logList.slice().reverse().map((logInfo) => (
                    <LogItem key={logInfo.logId} {...logInfo} />
                ))}
            </ul>
        </div>
    );
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export default function FictionTeam(team:BattlefieldInfo) {
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
                <div className="flex items-center gap-0 px-3 py-2.5 rounded-md mb-3 h-[40px]">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(51,102,255,0.8)] text-[#aaccff] text-[1.3rem]">
                        <FontAwesomeIcon icon={faShieldAlt}/>
                    </div>
                    <h2 className="text-[1.3rem] font-bold uppercase text-white">蓝方队伍</h2>
                </div>

                <TeamList teamList={teamList} />

                <LogList logList={logList} />
            </div>
        );
    }else {
        return (
            <div className="absolute min-w-[300px] grid grid-rows-[auto_auto_1fr]
                    z-[999] top-[20px] bottom-[80px] right-[20px]">
                <div className="flex items-center gap-0 px-3 py-2.5 rounded-md mb-3 h-[40px]">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(51,102,255,0.8)] text-[#aaccff] text-[1.3rem]">
                        <FontAwesomeIcon icon={faCrosshairs}/>
                    </div>
                    <h2 className="text-[1.3rem] font-bold uppercase text-white">红方队伍</h2>
                </div>

                <TeamList teamList={teamList} />
                <LogList logList={logList} />
            </div>
        );
    }
}