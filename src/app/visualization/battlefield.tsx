import * as Cesium from "cesium";
import {useLayoutEffect, useRef, useState} from "react";
import {Cartesian3, Color, Entity, HeadingPitchRoll, PolylineGlowMaterialProperty, Transforms, Viewer, Math as CesiumMath } from "cesium";
import Team, { BattlefieldInfo, LogInfo, TeamInfo } from "./team";

interface PlaneEntityOptions {
    viewer: Viewer;
    name?: string;
    position: [number, number, number];  // [lon, lat, height]
    orientationTarget?: [number, number, number]; // [lon, lat, height] 用于计算朝向
    heading?: number;  // 偏航角，度
    pitch?: number;    // 俯仰角，度
    roll?: number;     // 翻滚角，度
    modelUri?: string;
}

function generateRandomPositionsWithHeight(
    center: [number, number], // [lon, lat]
    latRange: number,          // 纬度范围
    lonRange: number,          // 经度范围
    heightRange: [number, number] = [500, 1500], // 高度范围
    count: number = 3
): [number, number, number][] {
    const [centerLon, centerLat] = center;
    const positions: [number, number, number][] = [];

    for (let i = 0; i < count; i++) {
        const lon = centerLon + (Math.random() - 0.5) * 2 * lonRange;
        const lat = centerLat + (Math.random() - 0.5) * 2 * latRange;
        const height = heightRange[0] + Math.random() * (heightRange[1] - heightRange[0]);
        positions.push([lon, lat, height]);
    }

    return positions;
}


function addPlaneEntity(options: PlaneEntityOptions) {
    const {
        viewer,
        name = '飞机',
        position,
        orientationTarget,
        heading = 0,
        pitch = 0,
        roll = 0,
        modelUri = '/mapdata/model/Cesium_Air.glb',
    } = options;

    const entity = viewer.entities.add({
        name,
        position: Cartesian3.fromDegrees(position[0], position[1], position[2]),
        orientation: orientationTarget
        ? Transforms.headingPitchRollQuaternion(
            Cartesian3.fromDegrees(orientationTarget[0], orientationTarget[1], orientationTarget[2]),
            new HeadingPitchRoll(
                CesiumMath.toRadians(heading),
                CesiumMath.toRadians(pitch),
                CesiumMath.toRadians(roll)
            )
        )
        : undefined,
        model: {
        uri: modelUri,
        minimumPixelSize: 60,
        maximumScale: 10000,
        show: true,
        },
    });

    return entity;
}

// 加载地形的异步函数
async function addWorldTerrainAsync(viewer: Cesium.Viewer) {
    try {
        const terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl('/mapdata/terrain/', {
            requestWaterMask: true,
            requestVertexNormals: true,
        });
        viewer.terrainProvider = terrainProvider;

        viewer.scene.globe.depthTestAgainstTerrain = true;

        console.log("地形加载成功");
    } catch (error) {
        // console.error(`地形加载失败: ${error}`);
        // alert('地形数据加载失败，请检查控制台日志');
    }
}

async function addWorldImageryAsync(viewer: Cesium.Viewer) {
    viewer.imageryLayers.removeAll();

    const tmsImageryProvider = new Cesium.UrlTemplateImageryProvider({
        url: '/mapdata/map4/laiwu/{z}/{x}/{y}.png',
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

        const container = document.getElementById('cesiumContainer');
        const canvas = container!.querySelector('canvas');
        if (canvas) {
            canvas.width = container!.clientWidth;
            canvas.height = container!.clientHeight;
        }


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

        const center1: [number, number] = [117.58, 36.20];
        const latRange = 0.05;
        const lonRange = 0.05;
        const heightRange: [number, number] = [500, 1500];
        // 生成随机位置
        const randomPositions1 = generateRandomPositionsWithHeight(center1, latRange, lonRange, heightRange, 3);

        // 循环调用生成飞机实体函数
        const entities1 = randomPositions1.map((pos, index) => 
            addPlaneEntity({
                viewer,
                name: `bluePlane${index + 1}`,
                position: pos,
                heading: 0,
                pitch: 0,
                roll: 0
            })
        );

         const center2: [number, number] = [117.65, 36.20];
         // 生成随机位置
        const randomPositions2 = generateRandomPositionsWithHeight(center2, latRange, lonRange, heightRange, 3);
         // 循环调用生成飞机实体函数
        const entities2 = randomPositions2.map((pos, index) => 
            addPlaneEntity({
                viewer,
                name: `redPlane${index + 1}`,
                position: pos,
                heading: 180,
                pitch: 0,
                roll: 0
            })
        );

        // websocketClient.connect();
        // websocketClient.onMessage((data) => {
        //     console.log("收到消息:", data);
        //     const now = new Date();
        //     const hours = now.getHours();   // 0-23
        //     const minutes = now.getMinutes(); // 0-59
        //     const seconds = now.getSeconds(); // 0-59
        //     let newLog: LogInfo = {
        //         logId: Date.now(),
        //         logTime: `${hours}:${minutes}:${seconds}`,
        //         logContent: "开始攻击"
        //     };

        //     setRedTeamState(prev => ({
        //         ...prev,              // 保留 type 和 teamInfo
        //         logInfo: [...prev.logInfo, newLog] // 更新 logInfo
        //     }));
        // });
        
        return () => {
            viewer.destroy();
        };
    }, []);
    return (
        <div className="h-full col-start-2 row-start-2 bg-[rgba(0,10,20,0.8)] border border-[rgba(0,150,255,0.4)] rounded-lg relative shadow-[0_0_25px_rgba(0,100,255,0.3)]">
            <Team {...blueTeamState} />
            <Team {...redTeamState} />
            <div className="relative w-full"
                    style={{
                        height: 'calc(100% - 60px)',
                        backgroundImage: `
                            linear-gradient(rgba(0,40,80,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(0,40,80,0.1) 1px, transparent 1px)`,
                        backgroundSize: '35px 35px',
                    }}
                    ref={battlefieldRef}>
                <div ref={containerRef} id={"cesiumContainer"} 
                        className="w-full min-w-[100px] min-h-[100px] m-0 p-0"
                        style={{ height: 'calc(100% - 20px)', bottom: '1px' }}>  
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