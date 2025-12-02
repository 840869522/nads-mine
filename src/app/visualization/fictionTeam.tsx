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

function getRandomDivisibleBy5(min: number = 200, max: number = 300): number {
    // 保证范围内能被5整除
    const start = Math.ceil(min / 5)
    const end = Math.floor(max / 5)

    const rand = Math.floor(Math.random() * (end - start + 1)) + start
    return rand * 5
}

async function fetchTeamMembers(sceneId: string) {
    const res = await fetch(`/back/api/visualization/${sceneId}/users`);
    const result = await res.json();

    if (result.code !== 200) {
        console.error(result.message);
        return [];
    }

    return result.data; // 这里是对象数组 [{ userId, username }, ...]
}

async function fetchTeams(sceneId: string) {
    const res = await fetch(`/back/api/visualization/${sceneId}/teams`);
    const result = await res.json();

    if (result.code !== 200) {
        console.error(result.message);
        return [];
    }

    return result.data; // 这里是对象数组 [{ userId, username }, ...]
}

function TeamInfoItem(props: { info: TeamInfo; index: number }) {
    return (
        <div className="flex items-center py-1 px-4 rounded-lg w-full">
            <div className="w-[16.666667%] flex justify-center items-center">
                <CrownIcon rank={props.index} />
            </div>
            <div className="w-[66.666667%] flex justify-center items-center font-medium text-sm text-white text-center">
                {props.info.teamName}
            </div>
            <div className="w-[16.666667%] flex justify-center items-center text-base font-bold text-yellow-500 text-center">
                {props.info.teamScore}
            </div>
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

function TeamList(props: {type:number; teamList: TeamInfo[]}){
     const teamInfoStyle1 = "bg-[linear-gradient(to_right,rgba(135,206,250,0),rgba(135,206,250,0.3))] border border-blue-400/30 rounded-md p-3 mb-3";
    const teamInfoStyle2 = "bg-[linear-gradient(to_left,rgba(135,206,250,0),rgba(135,206,250,0.3))] border border-blue-400/30 rounded-md p-3 mb-3";

    if(props.type === 0){
        return (
            <div className={teamInfoStyle1}>
                {/*<div className={styles.infoHeader}>*/}
                {/*    <div className={styles.infoHeaderItem}>排名</div>*/}
                {/*    <div className={styles.infoHeaderItem}>席位名称</div>*/}
                {/*    <div className={styles.infoHeaderItem}>总分</div>*/}
                {/*</div>*/}
                <ul className="flex flex-col gap-2 pt-2">
                    {props.teamList.map((teamInfo, index) => (
                        <TeamInfoItem key={teamInfo.teamId} info={teamInfo} index={index} />
                    ))}
                </ul>
            </div>
        )
    }
    else{
        return (
            <div className={teamInfoStyle2}>
                {/*<div className={styles.infoHeader}>*/}
                {/*    <div className={styles.infoHeaderItem}>排名</div>*/}
                {/*    <div className={styles.infoHeaderItem}>席位名称</div>*/}
                {/*    <div className={styles.infoHeaderItem}>总分</div>*/}
                {/*</div>*/}
                <ul className="flex flex-col gap-2 pt-2">
                    {props.teamList.map((teamInfo, index) => (
                        <TeamInfoItem key={teamInfo.teamId} info={teamInfo} index={index} />
                    ))}
                </ul>
            </div>
        )
    }
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
    const [teamList, setTeamList] = useState<TeamInfo[]>([])

    const [logList, setLogList] = useState<LogInfo[]>(team.logInfo)

    // 同步父组件更新
    useEffect(() => {
        let teams: TeamInfo[] = [];
        if(team.type === 1){
            // setTeamList(redTeamInfos);
            fetchTeamMembers(team.sceneId).then(users => {
                for(let i = 0; i < users.length; ++i){
                    // 1. 获取当前用户
                    const user = users[i];
                    
                    // 2. 提取需要赋值的变量（根据你的代码，id和name目前都取自 userId）
                    const currentId = user.userId; 

                    // 3. 关键修改：检查是否为 null (或者 undefined)
                    // 如果 teamId 或 teamName 任意一个是 null，则跳过本次循环
                    if (currentId === null) {
                        continue;
                    }
                    let item: TeamInfo = {
                        teamId: currentId,
                        teamName: currentId,
                        teamScore: getRandomDivisibleBy5() / 5
                    }
                    teams.push(item);
                }
                teams.sort((a: TeamInfo, b: TeamInfo) => b.teamScore - a.teamScore);
                if(teams.length === 0)
                    setTeamList(redTeamInfos);
                else
                    setTeamList(teams);
            });
        }else{
            // setTeamList(blueTeamInfos);
            fetchTeams(team.sceneId).then(teamList => {
                for(let j = 0; j < teamList.length; ++j){
                    // 1. 获取当前用户
                    const t = teamList[j];
                    
                    // 2. 提取需要赋值的变量（根据你的代码，id和name目前都取自 userId）
                    const currentId = t.teamId;
                    const currentName = t.teamName; 

                    // 3. 关键修改：检查是否为 null (或者 undefined)
                    // 如果 teamId 或 teamName 任意一个是 null，则跳过本次循环
                    if (currentId === null || currentName === null) {
                        continue;
                    }
                    let item: TeamInfo = {
                        teamId: currentId.toString(),
                        teamName: currentName,
                        teamScore: getRandomDivisibleBy5()
                    }
                    teams.push(item);
                }
                teams.sort((c: TeamInfo, d: TeamInfo) => d.teamScore - c.teamScore);
                if(teams.length === 0)
                    setTeamList(blueTeamInfos);
                else
                    setTeamList(teams);
            });
        }
    }, [team.sceneId])

    useEffect(()=>{
        setLogList(team.logInfo);
    }, [team.logInfo])
    
    if(team.type === 0){
        return (
            <div className="absolute min-w-[300px] grid grid-rows-[auto_auto_1fr]
                    z-[999] top-[20px] bottom-[80px] left-[20px]">
                <div className="flex items-center gap-0 px-3 py-2.5 rounded-md mb-3 h-[40px]">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(51,102,255,0.8)] text-[#aaccff] text-[1.3rem]">
                        <FontAwesomeIcon icon={faShieldAlt}/>
                    </div>
                    <h2 className="text-[1.3rem] font-bold uppercase text-white">队伍排名</h2>
                </div>

                <TeamList type={team.type} teamList={teamList} />

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
                    <h2 className="text-[1.3rem] font-bold uppercase text-white">成员排名</h2>
                </div>

                <TeamList type={team.type} teamList={teamList} />
                {/* <LogList logList={logList} /> */}
            </div>
        );
    }
}

const blueTeamInfos: TeamInfo[] = [
    {
        teamId: '1',
        teamName: '队伍1',
        teamScore: 295
    },
    {
        teamId: '2',
        teamName: '队伍2',
        teamScore: 285
    },
    {
        teamId: '3',
        teamName: '队伍3',
        teamScore: 270
    },
]

const redTeamInfos: TeamInfo[] = [
    {
        teamId: '1',
        teamName: 'student1',
        teamScore: 50
    },
    {
        teamId: '2',
        teamName: 'student2',
        teamScore: 45
    },
    {
        teamId: '3',
        teamName: 'student3',
        teamScore: 45
    },
    {
        teamId: '4',
        teamName: 'student4',
        teamScore: 30
    },
    {
        teamId: '5',
        teamName: 'student5',
        teamScore: 10
    },
    {
        teamId: '6',
        teamName: 'student6',
        teamScore: 10
    },
    {
        teamId: '7',
        teamName: 'student7',
        teamScore: 0
    },
]
