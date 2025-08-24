import * as Cesium from "cesium";
import {useEffect, useLayoutEffect, useRef, useState} from "react";
import {Cartesian3, Color, Entity, PolylineGlowMaterialProperty, Viewer} from "cesium";
import Team, { BattlefieldInfo, LogInfo, TeamInfo } from "./team";
import { websocketClient } from "@/utils/websocket";

// 加载地形的异步函数
async function addWorldTerrainAsync(viewer: Cesium.Viewer) {
    try {
        const terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl('http:localhost:8090/terrain/', {
            requestWaterMask: true,
            requestVertexNormals: true,
        });
        viewer.terrainProvider = terrainProvider;

        viewer.scene.globe.depthTestAgainstTerrain = true;

        console.log("地形加载成功");
    } catch (error) {
        console.error(`地形加载失败: ${error}`);
        alert('地形数据加载失败，请检查控制台日志');
    }
}

async function addWorldImageryAsync(viewer: Cesium.Viewer) {
    viewer.imageryLayers.removeAll();

    const tmsImageryProvider = new Cesium.UrlTemplateImageryProvider({
        url: 'http:localhost:8090/map/laiwu/{z}/{x}/{y}.png',
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        minimumLevel: 0,
        maximumLevel: 15,
    });

    viewer.scene.imageryLayers.addImageryProvider(tmsImageryProvider);
}

function shootLaser(
    viewer: Viewer,
    from: Cartesian3,
    to: Cartesian3,
    duration: number = 3000
): Entity {
    const laserEntity: Entity = viewer.entities.add({
        name: "激光射线",
        polyline: {
            positions: [from, to],
            width: 5.0,
            material: new PolylineGlowMaterialProperty({
                glowPower: 0.3,
                color: Color.RED.withAlpha(0.9)
            }),
            clampToGround: false
        }
    });

    setTimeout(() => {
        viewer.entities.remove(laserEntity);
    }, duration);

    return laserEntity;
}

export default function Battlefield () {
    const containerRef = useRef<HTMLDivElement>(null);
    const battlefieldRef = useRef<HTMLDivElement>(null);

    const blueTeam: BattlefieldInfo = {
        type: 0,
        teamInfo: blueTeamInfos,
        logInfo: blueLogInfos
    }

    const redTeam: BattlefieldInfo = {
        type: 1,
        teamInfo: redTeamInfos,
        logInfo: redLogInfos
    }

    const [redTeamState, setRedTeamState] = useState<BattlefieldInfo>(redTeam);
    const [blueTeamState, setBlueTeamState] = useState<BattlefieldInfo>(blueTeam);

    useLayoutEffect(() => {
        if (!containerRef.current) return;

        Cesium.Ion.defaultAccessToken = ''

        const viewer = new Cesium.Viewer(containerRef.current, {
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,         // 隐藏主视图控件
            animation: false,
            timeline: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            fullscreenButton: true,
            baseLayer: false,
            requestRenderMode: true, // 静态场景只在需要时渲染
        });

        viewer.resize();

        addWorldImageryAsync(viewer).catch(err => {
            console.error('加载影像图层失败:', err);
        });

        // viewer.resolutionScale = window.devicePixelRatio;
        // viewer.scene.globe.maximumScreenSpaceError = 1;


        // 调用加载地形函数
        addWorldTerrainAsync(viewer);

        viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(
                117.58,
                36.08,
                10000
            ),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-45),
                roll: 0
            }
        });

        websocketClient.connect();
        websocketClient.onMessage((data) => {
            console.log("收到消息:", data);
            const now = new Date();
            const hours = now.getHours();   // 0-23
            const minutes = now.getMinutes(); // 0-59
            const seconds = now.getSeconds(); // 0-59
            let newLog: LogInfo = {
                logId: Date.now(),
                logTime: `${hours}:${minutes}:${seconds}`,
                logContent: "开始攻击"
            };

            setRedTeamState(prev => ({
                ...prev,              // 保留 type 和 teamInfo
                logInfo: [...prev.logInfo, newLog] // 更新 logInfo
            }));
        });
        
        return () => {
            viewer.destroy();
        };
    }, []);
    return (
        <div className="
                h-full w-full col-start-2 row-start-2 bg-[rgba(0,10,20,0.8)] 
                border border-[rgba(0,150,255,0.4)] rounded-[8px] relative overflow-hidden 
                shadow-[0_0_25px_rgba(0,100,255,0.3)]">
            <Team {...blueTeamState} />
            <Team {...redTeamState} />
            <div className="relative w-full h-[500px] overflow-hidden"
                    style={{
                        backgroundImage: `
                        linear-gradient(rgba(0,40,80,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,40,80,0.1) 1px, transparent 1px)`,
                        backgroundSize: '35px 35px'}} 
                    ref={battlefieldRef}>
                <div ref={containerRef} id={"cesiumContainer"} 
                    className="
                    w-full min-h-[300px] min-w-[100px]
                    h-full
                    m-0 p-0 bottom-[1px]
                    overflow-hidden block">  
                </div>
            </div>
        </div>
    );
}

const blueTeamInfos: TeamInfo[] = [
    {
        teamId: 1,
        teamName: '蓝方席位1',
        teamScore: 295
    },
    {
        teamId: 2,
        teamName: '蓝方席位2',
        teamScore: 285
    },
    {
        teamId: 3,
        teamName: '蓝方席位3',
        teamScore: 270
    },
]

const blueLogInfos: LogInfo[] = [
    {
        logId: 1,
        logTime: '12:45:01',
        logContent: '检测到异常网络流量，已启动深度分析'
    },
    {
        logId: 2,
        logTime: '12:42:33',
        logContent: '成功阻止针对Web服务器的SQL注入攻击'
    },
]

const redTeamInfos: TeamInfo[] = [
    {
        teamId: 1,
        teamName: '红方席位1',
        teamScore: 320
    },
    {
        teamId: 2,
        teamName: '红方席位2',
        teamScore: 300
    },
    {
        teamId: 3,
        teamName: '红方席位3',
        teamScore: 285
    },
    {
        teamId: 4,
        teamName: '红方席位4',
        teamScore: 270
    },
]

const redLogInfos: LogInfo[] = [
    {
        logId: 1,
        logTime: '12:44:50',
        logContent: '成功渗透目标数据库，提取敏感数据'
    },
    {
        logId: 2,
        logTime: '12:42:10',
        logContent: '绕过WAF防护，发起SQL注入攻击'
    },
    {
        logId: 3,
        logTime: '12:44:50',
        logContent: '成功渗透目标数据库，提取敏感数据'
    },
    {
        logId: 4,
        logTime: '12:42:10',
        logContent: '绕过WAF防护，发起SQL注入攻击'
    },
    {
        logId: 5,
        logTime: '12:44:50',
        logContent: '成功渗透目标数据库，提取敏感数据'
    },
    {
        logId: 6,
        logTime: '12:42:10',
        logContent: '绕过WAF防护，发起SQL注入攻击'
    },
]